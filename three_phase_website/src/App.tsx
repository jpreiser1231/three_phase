import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'


export function Home()
{
return(
    <>
      <h1 id="welcome_title">Welcome To Jay Bank</h1>
      <div id="login-container">
        <text className="sign-in-text">Username</text>
        <input type="text" id="username_input" placeholder="Enter your username"/>
        <text className="sign-in-text">Password</text>
        <input type="text" id="pass_input" placeholder="Enter your password"/>
        <div>
          <button type="submit">Sign Up</button>
          <button type="submit">Sign In</button>
        </div>
      </div>

    </>
)
}

export default Home

