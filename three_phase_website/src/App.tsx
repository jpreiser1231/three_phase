import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import {useEffect} from "react";
import {arrayBufferToBase64, importPublicKey} from "./encryptionConverter.ts";



export function Home()
{
    const [key, setKey] = useState <CryptoKey>();
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
        if(!key){
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



    return(
    <>
      <h1 id="welcome_title">Welcome To Jay Bank</h1>
      <div id="login-container">
        <text className="sign-in-text">Username</text>
        <input type="text" id="username_input" placeholder="Enter your username"/>
        <text className="sign-in-text">Password</text>
        <input type="text" id="pass_input" placeholder="Enter your password"/>
        <div>
          <button type="submit" onClick={}>Sign Up</button>
          <button type="submit">Sign In</button>
        </div>
      </div>
    </>
)
}

export default Home

