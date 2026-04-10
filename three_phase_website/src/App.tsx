import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import {useEffect} from "react";
import {arrayBufferToBase64, importPublicKey} from "./encryptionConverter.ts";


export function App() {
    const [key, setKey] = useState<CryptoKey>();
    const [usernameInput, setUsername] = useState<string>("");
    const [passwordInput, setPassword] = useState<string>("");
    const [display, setDisplay] = useState<string>();
    const [page, setPage] = useState<string>("home");
    const [accounts, setAccounts] = useState<{
        accountID: number,
        balance: number,
        accountType: string,
        ownerID: number
    }[]>();
    const [accountID, setAccountID] = useState<number>();
    const [type, setType] = useState<string>();
    const [transactions, setTransactions] = useState<{
        transactionID: number,
        amount: number,
        toAcc: number,
        fromAcc: number
    }[]>();

    const refreshKey = () => {
        fetch(`http://localhost:3000/public_key`)
            .then(res => res.json())
            .then(public_key => {
                importPublicKey(public_key).then(cryptKey => setKey(cryptKey));
            });
    }
    useEffect(() => {
        refreshKey();
    }, []);


    async function encrypt(dataToEncode: string) {
        if (!key) {
            return;
        }

        const data = new TextEncoder().encode(dataToEncode)

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            key,
            data
        );
        console.log("BUFFER", encrypted);

        const stringed = arrayBufferToBase64(encrypted);
        console.log("STRING", stringed);
        return stringed;

    }

    const base64ToUrlSafe = (base64Str: string): string => {
        return base64Str
            .replace(/\+/g, '-') // Replace + with -
            .replace(/\//g, '_') // Replace / with _
            .replace(/=+$/, ''); // Remove trailing = padding
    };

    async function signIn(username: string, password: string) {
        const encryptedUsername = base64ToUrlSafe(username);
        const encryptedPassword = base64ToUrlSafe(password);
        fetch(`http://localhost:3000/public_key`, {
            method: 'GET',
            headers: ({
                'content-type': 'application/json',
            }),
            body: JSON.stringify({
                encryptedUsername,
                encryptedPassword
            }),
        }).then((res) => {
            if (!res.ok) {
                res.json().then(message => {
                    setDisplay(message);
                })
            } else {
                res.json().then((data) => {
                    setAccounts(data)
                })
                setPage("dashboard")
            }
        })
    }

    async function signUp(username: string, password: string) {
        setDisplay("Creating user...");
        const encryptedUsername = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        fetch(`http://localhost:3000/public_key`, {
            method: 'POST',
            headers: ({
                'content-type': 'application/json',
            }),
            body: JSON.stringify({
                encryptedUsername,
                encryptedPassword
            }),
        }).then((res) => {
            if (!res.ok) {
                res.json().then(message => {
                    setDisplay(message);
                })
            } else {
                res.json().then((data) => {
                    setAccounts(data)
                })
                setPage("dashboard")
            }
        })
    }


    return (
        <>
            {page === "home" && <>
                <h1 id="welcome_title">Welcome To Jay Bank</h1>
                <div id="login-container">
                    <text className="sign-in-text">Username</text>
                    <input type="text" id="username_input" value={usernameInput} onChange={e => {
                        setUsername(e.target.value)
                    }} placeholder={"Enter your username"}/>
                    <text className="sign-in-text">Password</text>
                    <input type="password" id="pass_input" value={passwordInput} onChange={e => {
                        setPassword(e.target.value)
                    }} placeholder="Enter your password"/>
                    <div>
                        <button type="submit" onClick={() => {
                            signUp(usernameInput, passwordInput).then()
                        }}>Sign Up
                        </button>
                        <button type="submit" onClick={() => {
                            signIn(usernameInput, passwordInput).then()
                        }}>Sign In
                        </button>
                    </div>
                </div>
            </>
            }

            {page === "dashboard" && <>
                { accounts &&
                    accounts.map((item, index) =>
                        <div key = {index}>
                            <div id = "account-list">{item}</div>
                        </div>
                )
                }
                </>
            }
        </>
    )
}

export default App

