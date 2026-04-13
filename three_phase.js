import mysql from 'mysql2/promise'
import crypto from "crypto";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import config from "./config.js"

const app = express();
app.use(cors({
    methods: ['GET', 'POST'],
}));
app.use(bodyParser.json());
const port = config.port;

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})

const connection = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass,
    port: config.db.port,
    database: config.db.db
})
const generateKeys = () => {
    const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048, // Recommended key size for security
        publicKeyEncoding: {
            type: 'spki', // Recommended for public keys
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8', // Recommended for private keys
            format: 'pem',
        },
    });
    console.log('Private Key:', keys.privateKey);
    console.log('Public Key:', keys.publicKey);
    return keys;
}

let {publicKey, privateKey} = generateKeys();
app.get("/public_key", (req, res) => {
    res.status(200).json(publicKey);
});

const decryptData = (base64Data) => {
    // 1. Convert from encoded string to a buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // 2. Explicitly define padding and hash to match the Web Crypto API
    return crypto.privateDecrypt(
        {
            key: privateKey, // Your 2048-bit key from generateKeys()
            oaepHash: "sha256", // MUST BE THIS to match client's "SHA-256"
        },
        buffer
    ).toString("utf8");
};


async function getUser(username) {
    const [results, fields] = await connection.query(`SELECT * FROM logins WHERE username = "${username}"`);
    if (results.length === 1)
        return results[0];

    return false;
}


function verifyPassword(inputPassword, storedSalt, storedHash, actionOnSuccess, actionOnFail) {
    crypto.scrypt(inputPassword, storedSalt, 64, (err, derivedKey) => {
        if (err) throw err;

        const inputHash = derivedKey.toString('hex');

        // Compare the newly generated hash with the one stored in the database
        if (storedHash === inputHash) {
            actionOnSuccess();
        } else
            actionOnFail();
    });
}

const urlSafeToBase64 = (urlSafeStr) => {
    // Add padding back for standard Base64 if needed
    let standardB64 = urlSafeStr.replace(/-/g, '+').replace(/_/g, '/');
    while (standardB64.length % 4) {
        standardB64 += '=';
    }
    return standardB64;
};

async function getAccounts(user) {
    if (user.access === 1) {
        const [results, fields] = await connection.query('SELECT * FROM accounts');
        return results;
    }
    const [results, fields] = await connection.query(`SELECT * FROM accounts WHERE accounts.ownerID = ${user.id}`)
    return results;
}

async function getTransactions(accountID) {
    const [results, fields] = await connection.query(`SELECT * FROM transactions WHERE transactions.toAcc = ${accountID} OR transactions.fromAcc = ${accountID}`);
    return results;
}

async function maxLoginID() {
    const [results, fields] = await connection.query(`SELECT max(id) FROM logins`);
    return results[0]["max(id)"];
}

async function maxAccountID() {
    const [results, fields] = await connection.query(`SELECT max(accountID) FROM accounts`);
    return results[0]["max(accountID)"];
}

async function maxTransactionID() {
    const [results, fields] = await connection.query(`SELECT max(transactionID) FROM transactions`);
    return results[0]["max(transactionID)"];
}

async function createUser(username, password) {
    const salt = crypto.randomBytes(16).toString('hex');
    let id = await maxLoginID() + 1;
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) throw err;

        const hash = derivedKey.toString('hex');

        connection.query(`INSERT INTO logins VALUES("${username}", ${id}, "${hash}", "${salt}", 0)`);
    })

}

async function createAccount(type, ownerID) {
    let id = await maxAccountID() + 1;
    await connection.query(`INSERT INTO accounts VALUES(${id}, 0, "${type}", ${ownerID})`)
}

async function verifyAccess(user, accountID) {
    if (user.access === 1)
        return true;

    else {
        const [results, fields] = await connection.query(`SELECT DISTINCT ownerID FROM accounts WHERE ${accountID} = accountID`)
        if (results.length === 0)
            return false;

        if (results[0].ownerID === user.id)
            return true;
    }
    return false;
}

async function verifyBalance(accountID, amount) {
    const [results, fields] = await connection.query(`SELECT DISTINCT * FROM accounts WHERE accountID = ${accountID}`);
    if (results[0].balance >= amount)
        return true;

    return false;
}

async function transfer(user, toAccountID, fromAccountID, amount) {
    if (await verifyAccess(user, toAccountID) && await verifyAccess(user, fromAccountID)) {
        if (await verifyBalance(fromAccountID, amount)) {
            const [results, fields] = await connection.query(`SELECT balance FROM accounts WHERE accountID = ${toAccountID}`);
            let newBalance = results[0].balance + amount;
            const [results1, fields1] = await connection.query(`SELECT balance FROM accounts WHERE accountID = ${fromAccountID}`);
            let newBalance1 = results1[0].balance - amount;
            await connection.query(`UPDATE accounts SET balance = ${newBalance} WHERE accountID = ${toAccountID}`);
            await connection.query(`UPDATE accounts SET balance = ${newBalance1} WHERE accountID = ${fromAccountID}`);
            let id = await maxTransactionID() + 1;
            await connection.query(`INSERT INTO transactions VALUES(${id}, ${amount}, ${fromAccountID}, ${toAccountID})`);
            return 200;
        } else return 400;
    } else return 403;
}

async function deposit(user, accountID, amount) {
    if (user.access === 1) {
        const [results, fields] = await connection.query(`SELECT balance FROM accounts WHERE accountID = ${accountID}`);
        let newBalance = results[0].balance + amount;
        await connection.query(`UPDATE accounts SET balance = ${newBalance} WHERE accountID = ${accountID}`);
        let id = await maxTransactionID() + 1;
        await connection.query(`INSERT INTO transactions VALUES(${id}, ${amount}, null, ${accountID})`);
        return 200;
    } else return 403;
}

async function withdraw(user, accountID, amount) {
    if (user.access === 1) {
        if (await verifyBalance(accountID, amount)) {
            const [results, fields] = await connection.query(`SELECT balance FROM accounts WHERE accountID = ${accountID}`);
            let newBalance = results[0].balance - amount;
            await connection.query(`UPDATE accounts SET balance = ${newBalance} WHERE accountID = ${accountID}`);
            let id = await maxTransactionID() + 1;
            await connection.query(`INSERT INTO transactions VALUES(${id}, ${amount}, ${accountID}, null)`);
            return 200;
        } else return 400;
    } else return 403;
}

app.get("/Accounts", async (req, res) => {
    const {u, p} = req.query;
    let encryptedUserName = urlSafeToBase64(u)
    let encryptedPassword = urlSafeToBase64(p)
    if (!encryptedUserName || !encryptedPassword) {
        return res.status(400).json("Username and password are required")
    }

    //make decryped username and password
    let decryptedUserName = decryptData(encryptedUserName);
    let decryptedPassword = decryptData(encryptedPassword);
    getUser(decryptedUserName).then((user) => {
        if(user) {
            verifyPassword(decryptedPassword, user.salt, user.hash, () => getAccounts(user).then((results) => {
                return res.status(200).json(results);
            }), () => {
                return res.status(403).json("Username or password are incorrect")
            });
        }
        else
        {
            return res.status(404).json("User does not exist")
        }
    })

})

app.get("/transactions", (req, res) => {
    const {u, p, accountID} = req.query;
    let encryptedUserName = urlSafeToBase64(u)
    let encryptedPassword = urlSafeToBase64(p)
    if (!encryptedUserName || !encryptedPassword) {
        return res.status(400).json("Username and password are required")
    }

    //make decryped username and password
    let decryptedUserName = decryptData(encryptedUserName);
    let decryptedPassword = decryptData(encryptedPassword);

    getUser(decryptedUserName).then((user) => {
        if (user) {
            verifyAccess(user, accountID).then((r) => {
                if (r) {
                    verifyPassword(decryptedUserName, user.salt, user.hash, () => {
                        getTransactions(accountID).then((results) => {
                            return res.status(200).json(results);
                        })
                    }, () => {
                        return res.status(403).json("Username or password are incorrect")
                    });
                }
            })
        }
        else {
            return res.status(403).json("User does not exist");
        }
    })
})

app.post("/login", (req, res) => {
    const{username, password} = req.body;
    let decryptedUsername = decryptData(username);
    let decryptedPassword = decryptData(password);
    getUser(decryptedUsername).then((user) => {
        if(user)
            return res.status(400).json("Username already exists");
        
        else
        {
            createUser(decryptedUsername, password).then((result) => {
                return res.status(201).json(result);
            })    
        }
    })
})

app.post("/accounts", (req, res) => {
    const {username, password, accountType} = req.body;
    let decryptedUsername = decryptData(username);
    let decryptedPassword = decryptData(password);
    getUser(decryptedUsername).then((user) => {
        if(user) {
            verifyPassword(decryptedPassword, user.salt, user.hash, () => {
                createAccount(accountType, user.ownerID).then((result) => {
                    return res.status(201).json(result);
                })
            }, () => {
                return res.status(403).json("Username or password are incorrect")
            })
        }
    else
        {
            return res.status(404).json("User does not exist");
        }})
})

app.post('/deposit', (req, res) => {
    const{username, password, accountID, amount} = req.body;
    let decryptedUsername = decryptData(username);
    let decryptedPassword = decryptData(password);
    if(!username || !password || !accountID  || !amount) {
        return res.status(400).json("Username, password, accountID, and amount are required");
    }
    getUser(decryptedUsername).then((user) => {
        if(user) {
            verifyPassword(decryptedPassword, user.salt, user.hash, () => {
                deposit(user, accountID, amount).then((result) => {
                    if (result === 403)
                        return res.status(403).json("Access denied: admin only")
                    else return res.status(200).json("Deposit successful")
                })
            }, () => {
                return res.status(403).json("Username or password are incorrect")
            })
        }
        else
        {
            return res.status(404).json("User does not exist");
        }
    })
})

app.post('/withdraw', (req, res) => {
    const{username, password, accountID, amount} = req.body;
    let decryptedUsername = decryptData(username);
    let decryptedPassword = decryptData(password);
    if(!username || !password || !accountID  || !amount) {
        return res.status(400).json("Username, password, accountID, and amount are required");
    }
    getUser(decryptedUsername).then((user) => {
        if(user) {

            verifyPassword(decryptedPassword, user.salt, user.hash, () => {
                withdraw(user, accountID, amount).then((result) => {
                    if (result === 403)
                        return res.status(403).json("Access denied: admin only");

                    else if (result === 400)
                        return res.status(400).json("Insufficient funds to withdraw");

                    else return res.status(200).json("Withdraw successful")
                })
            }, () => {
                return res.status(403).json("Username or password are incorrect")
            })
        }
    else {
        return res.status(404).json("User does not exist");
        }
    })
})

app.post('/transfer', (req, res) => {
    const{username, password, toAccount, fromAccount, amount} = req.body;
    let decryptedUsername = decryptData(username);
    let decryptedPassword = decryptData(password);
    if(!username || !password || !accountID  || !amount) {
        return res.status(400).json("Username, password, toAccountID, fromAccountID, and amount are required");
    }
    getUser(decryptedUsername).then((user) => {
        if(user) {
            verifyPassword(decryptedPassword, user.salt, user.hash, () => {
                transfer(user, toAccountID, fromAccountID, amount).then((result) => {
                    if (result === 403)
                        return res.status(403).json("Access denied: access to both accounts is required");
                    else if (result === 400)
                        res.status(400).json("Insufficient funds");

                    else return res.status(200).json("Transfer successful");
                })
            }, () => {
                return res.status(403).json("Username or password are incorrect")
            })
        }
    else
        {
            return res.status(404).json("User does not exist");
        }
    })
})

//testing getAccounts
// getUser("luksh").then((result) => {
//     getAccounts(result).then(accounts => {
//         console.log(accounts)
//     });
// })

//testing getTransactions
// getTransactions(0).then(results => {
//     console.log(results);
// });

//testing largestId
// maxLoginID().then(results => {
//     console.log(results);
// });
//
// maxAccountID().then(results => {
//     console.log(results);
// })
//
// maxTransactionID().then(results => {
//     console.log(results);
// })

//testing createUser
// createUser('jaymoney67', 'jayprize')

//testing createAccount
//createAccount("Checking", 7)

//testing verifyAccess
// getUser(`jaymoney67`).then((user) => {
//     verifyAccess(user, 9).then((results) => {
//         console.log(results);
//     });
// })

//testing verifyBalance
// //DOESNT WORK TEST AGAIN
// verifyBalance(9, 50).then((results) => {
//     console.log(results);
// });

//testing transfer
// getUser("luksh").then((user) =>
// {
//     transfer(user, 0, 1, 25).then((results) => {
//         console.log(results);
//     });
// })

//testing deposit
// getUser("bigadmin").then((user) => {
//     deposit(user, 10, 25).then((results) => {
//         console.log(results);
//     })
// })

//testing withdraw
// getUser("bigadmin").then((user) => {
//     withdraw(user, 10, 30).then((results) => {
//         console.log(results);
//     });
// })