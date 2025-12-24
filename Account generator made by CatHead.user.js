// ==UserScript==
// @name         Blooket Account Generator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Generate infinite accounts
// @author       CatHead
// @match        https://id.blooket.com/signup
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const MONTH = "1"; // 1=January, 2=February, etc
    const YEAR = "1990";
    const WEBHOOK_URL = "...";

    function generateBlooketPassword() {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';

        let password = '';
        password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));

        const allChars = lowercase + uppercase + numbers;
        for (let i = 0; i < 9; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    function randomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async function createMailTmAccount(retries = 5) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const domainRes = await fetch("https://api.mail.tm/domains");
                if (!domainRes.ok) {
                    if (domainRes.status === 429) {
                        console.log(`Rate limited on domains, waiting ${attempt * 2}s...`);
                        await new Promise(r => setTimeout(r, attempt * 2000));
                        continue;
                    }
                    throw new Error(`Failed to fetch domains: ${domainRes.status}`);
                }
                const domainJson = await domainRes.json();
                const domain = domainJson?.["hydra:member"]?.[0]?.domain;
                if (!domain) throw new Error("No domains returned from mail.tm");

                const username = randomString(8);
                const password = generatePassword();
                const address = `${username}@${domain}`;

                const createRes = await fetch("https://api.mail.tm/accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address, password }),
                });

                if (createRes.status === 429) {
                    console.log(`Rate limited on account creation, waiting ${attempt * 2}s...`);
                    await new Promise(r => setTimeout(r, attempt * 2000));
                    continue;
                }

                if (!createRes.ok && createRes.status !== 400) {
                    const body = await createRes.text().catch(() => "");
                    throw new Error(`Failed to create mail.tm account: ${createRes.status} ${body}`);
                }

                const tokenRes = await fetch("https://api.mail.tm/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address, password }),
                });

                if (tokenRes.status === 429) {
                    console.log(`Rate limited on token, waiting ${attempt * 2}s...`);
                    await new Promise(r => setTimeout(r, attempt * 2000));
                    continue;
                }

                if (!tokenRes.ok) throw new Error(`Failed to get token: ${tokenRes.status}`);
                const tokenJson = await tokenRes.json();
                if (!tokenJson?.token) throw new Error("mail.tm token not returned");

                return { address, password, token: tokenJson.token };
            } catch (error) {
                if (attempt === retries) throw error;
                console.log(`Attempt ${attempt} failed, retrying...`);
                await new Promise(r => setTimeout(r, attempt * 2000));
            }
        }
    }

    async function waitForVerificationEmail(token, maxAttempts = 30, delayMs = 3000) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const res = await fetch("https://api.mail.tm/messages", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.status === 429) {
                    console.log("Rate limited on messages, waiting 5s...");
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }

                if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
                const data = await res.json();
                const messages = data["hydra:member"];

                if (messages && messages.length > 0) {
                    const msg = messages[0];
                    const codeMatch = msg.intro?.match(/\d{6}/);
                    if (codeMatch) return codeMatch[0];
                }
            } catch (error) {
                console.log("Error fetching messages, retrying...");
            }
            await new Promise(r => setTimeout(r, delayMs));
        }
        throw new Error("Verification email did not arrive in time");
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkExist = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkExist);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkExist);
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                }
            }, 100);
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const MONTH_NAMES = { // idfk why i did this tbh its 3 am and i need help
        '1': 'January', '2': 'February', '3': 'March', '4': 'April',
        '5': 'May', '6': 'June', '7': 'July', '8': 'August',
        '9': 'September', '10': 'October', '11': 'November', '12': 'December'
    };

    async function autoFillSignup() {
        try {
            console.log('Blooket Auto-Clicker: Starting...');

            const PASSWORD = generateBlooketPassword();
            console.log('Generated password for account');

            console.log('Looking for Teacher button...');
            const teacherButton = await waitForElement('.RoleSelection_buttonInside__i_4_j');
            if (teacherButton) {
                await wait(500);
                teacherButton.click();
                console.log('Clicked Teacher');
            }

            console.log('Setting Birthday Month...');
            const monthInput = await waitForElement('input#month[type="hidden"]');
            const monthPicker = await waitForElement('input.rs-picker-toggle-textbox[readonly]');
            const monthDisplay = document.querySelector('span.rs-picker-toggle-placeholder, span.rs-picker-toggle-value');

            if (monthInput && monthPicker) {
                monthInput.value = MONTH;
                monthPicker.value = MONTH;
                if (monthDisplay) {
                    monthDisplay.textContent = MONTH_NAMES[MONTH];
                    monthDisplay.className = 'rs-picker-toggle-value';
                }
                const monthPickerContainer = document.querySelector('span.DropdownPicker_dropdown__8W6y0 .rs-picker');
                if (monthPickerContainer) {
                    monthPickerContainer.classList.add('rs-picker-has-value');
                }
                console.log(`Set month to: ${MONTH} (${MONTH_NAMES[MONTH]})`);
            }

            console.log('Setting Birthday Year...');
            const yearInput = await waitForElement('input#year[type="hidden"]');
            const yearPickers = document.querySelectorAll('input.rs-picker-toggle-textbox[readonly]');
            const yearPicker = yearPickers[1];
            const yearDisplay = document.querySelectorAll('span.rs-picker-toggle-placeholder, span.rs-picker-toggle-value')[1];

            if (yearInput && yearPicker) {
                yearInput.value = YEAR;
                yearPicker.value = YEAR;
                if (yearDisplay) {
                    yearDisplay.textContent = YEAR;
                    yearDisplay.className = 'rs-picker-toggle-value';
                }
                const yearPickerContainer = document.querySelectorAll('span.DropdownPicker_dropdown__8W6y0 .rs-picker')[1];
                if (yearPickerContainer) {
                    yearPickerContainer.classList.add('rs-picker-has-value');
                }
                console.log(`Set year to: ${YEAR}`);
            }

            console.log('Looking for Next button...');
            const nextButton = await waitForElement('button[type="submit"].formButton');
            if (nextButton) {
                nextButton.click();
                console.log('Clicked Next button');
            }

            console.log('Looking for Email & Password button...');
            const emailButton = await waitForElement('button.AuthenticationSelection_button__fIYry');
            if (emailButton) {
                emailButton.click();
                console.log('Clicked Email & Password button');
            }

            console.log('Creating temporary email account...');
            const emailAccount = await createMailTmAccount();
            console.log(`Created email: ${emailAccount.address}`);

            console.log('Looking for email input...');
            const emailInput = await waitForElement('input[name="email"]');
            if (emailInput) {
                emailInput.value = emailAccount.address;
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Filled email: ${emailAccount.address}`);
            }

            console.log('Looking for Submit button...');
            let submitButton = await waitForElement('button[type="submit"].formButton');
            if (submitButton) {
                submitButton.removeAttribute('disabled');
                submitButton.click();
                console.log('Clicked Submit button');
            }

            console.log('Waiting for verification email...');
            const verificationCode = await waitForVerificationEmail(emailAccount.token);
            console.log(`Received verification code: ${verificationCode}`);

            console.log('Looking for verification code input...');
            const codeInput = await waitForElement('input[name="code"]');
            if (codeInput) {
                codeInput.value = verificationCode;
                codeInput.dispatchEvent(new Event('input', { bubbles: true }));
                codeInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Filled verification code: ${verificationCode}`);
            }

            console.log('Looking for Submit button...');
            submitButton = await waitForElement('button[type="submit"].formButton');
            if (submitButton) {
                submitButton.removeAttribute('disabled');
                submitButton.click();
                console.log('Clicked Submit button for verification');
            }

            console.log('Looking for password input...');
            const passwordInput = await waitForElement('input[name="password"]');
            if (passwordInput) {
                passwordInput.value = PASSWORD;
                passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Filled password');
            }

            console.log('Looking for confirm password input...');
            const password2Input = await waitForElement('input[name="password2"]');
            if (password2Input) {
                password2Input.value = PASSWORD;
                password2Input.dispatchEvent(new Event('input', { bubbles: true }));
                password2Input.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Filled confirm password');
            }

            console.log('Looking for Submit button...');
            submitButton = await waitForElement('button[type="submit"].formButton');
            if (submitButton) {
                submitButton.removeAttribute('disabled');
                submitButton.click();
                console.log('Clicked Submit button for password');
            }

            const username = emailAccount.address.split('@')[0];
            console.log(`Using username: ${username}`);

            console.log('Looking for username input...');
            const usernameInput = await waitForElement('input[name="username"]');
            if (usernameInput) {
                usernameInput.value = username;
                usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
                usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Filled username: ${username}`);
            }

            console.log('Looking for agreement checkbox...');
            const agreeCheckbox = await waitForElement('input#is-agreed[type="checkbox"]');
            if (agreeCheckbox) {
                agreeCheckbox.checked = true;
                agreeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Checked agreement checkbox');
            }

            console.log('Discord webhook dipshit...');
            try {
                await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `New account:\nMail: ${emailAccount.address}\nPassword: ${PASSWORD}`
                    })
                });
                console.log('Webhook sent successfully');
            } catch (error) {
                console.error('Failed to send webhook:', error);
            }

            console.log('Looking for final Submit button...');
            submitButton = await waitForElement('button[type="submit"].formButton');
            if (submitButton) {
                submitButton.removeAttribute('disabled');
                submitButton.click();
                console.log('Clicked final Submit button - Account created!');
            }

            console.log('Blooket Auto-Clicker: Completed!');
        } catch (error) {
            console.error('Blooket Auto-Clicker Error:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoFillSignup);
    } else {
        autoFillSignup();
    }
})();
