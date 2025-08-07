document.addEventListener('DOMContentLoaded', () => {
    const microAccountInput = document.getElementById('microAccountInput');
    const validateButton = document.getElementById('validateButton');
    const resultDiv = document.getElementById('result');
    const logOutputPre = document.querySelector('#logOutput pre');

    // Custom logging function
    function appLog(message) {
        console.log(message); // Keep logging to console for debugging
        logOutputPre.textContent += message + '\n';
        logOutputPre.scrollTop = logOutputPre.scrollHeight; // Auto-scroll to bottom
    }

    validateButton.addEventListener('click', validateMicroAccount);

    function displayResult(isSuccess, message, decodedData = null) {
        resultDiv.innerHTML = '';
        resultDiv.className = 'result-area'; // Reset classes

        if (isSuccess) {
            resultDiv.classList.add('success');
            resultDiv.innerHTML = `
                <div class="icon">&#10003;</div>
                <div>${message}</div>
                ${decodedData ? `<div>Typ identyfikatora: ${decodedData.type}</div><div>Numer: ${decodedData.number}</div>` : ''}
            `;
        } else {
            resultDiv.classList.add('error');
            resultDiv.innerHTML = `
                <div class="icon">&#10007;</div>
                <div>${message}</div>
            `;
        }
    }

    function validateMicroAccount() {
        logOutputPre.textContent = ''; // Clear previous logs
        let accountNumber = microAccountInput.value;

        appLog('Original input:' + accountNumber);

        // Krok 0: Przygotowanie danych (Sanityzacja)
        accountNumber = accountNumber.replace(/\s/g, ''); // 1. Usuń białe znaki
        appLog('After sanitization:' + accountNumber);

        if (!/^[0-9]+$/.test(accountNumber)) { // 2. Sprawdź znaki
            displayResult(false, 'Błąd: Numer rachunku może zawierać tylko cyfry.');
            appLog('Validation failed: Non-digit characters.');
            return;
        }

        // Krok 1: Weryfikacja długości
        if (accountNumber.length !== 26) {
            displayResult(false, `Błąd: Numer rachunku musi mieć 26 cyfr (wpisano ${accountNumber.length}).`);
            appLog('Validation failed: Incorrect length.' + accountNumber.length);
            return;
        }
        appLog('Length check passed.');

        // Krok 2: Weryfikacja sumy kontrolnej (Standard NRB/IBAN)
        const controlSum = accountNumber.substring(0, 2);
        const restOfAccount = accountNumber.substring(2);
        const rearrangedAccount = restOfAccount + '2521' + controlSum; // 'PL' = 2521, standard IBAN rearrangement
        appLog('Control sum:' + controlSum);
        appLog('Rest of account:' + restOfAccount);
        appLog('Rearranged account for checksum:' + rearrangedAccount);

        let remainder = 0;
        for (let i = 0; i < rearrangedAccount.length; i++) {
            remainder = (remainder * 10 + parseInt(rearrangedAccount[i])) % 97;
        }
        appLog('Checksum remainder (modulo 97):' + remainder);

        if (remainder !== 1) {
            displayResult(false, 'Błąd: Nieprawidłowa suma kontrolna numeru mikrorachunku.');
            appLog('Validation failed: Checksum (modulo 97) failed.');
            return;
        }
        appLog('Checksum (modulo 97) passed.');

        // Krok 3: Weryfikacja stałych elementów identyfikacyjnych
        const nbpNumber = accountNumber.substring(2, 10);
        const nbpComplement = accountNumber.substring(10, 13);
        appLog('NBP Number:' + nbpNumber);
        appLog('NBP Complement:' + nbpComplement);

        if (nbpNumber !== '10100071') {
            displayResult(false, 'Błąd: Nieprawidłowy numer rozliczeniowy NBP.');
            appLog('Validation failed: NBP Number mismatch.');
            return;
        }
        if (nbpComplement !== '222') {
            displayResult(false, 'Błąd: Nieprawidłowy numer uzupełniający NBP.');
            appLog('Validation failed: NBP Complement mismatch.');
            return;
        }
        appLog('NBP elements check passed.');

        // Krok 4: Weryfikacja identyfikatora podatkowego (PESEL/NIP)
        const identifierTypeIndicator = accountNumber[13];
        let identifierNumber = '';
        let identifierType = '';
        appLog('Identifier type indicator:' + identifierTypeIndicator);

        if (identifierTypeIndicator === '1') {
            // PESEL
            identifierType = 'PESEL';
            identifierNumber = accountNumber.substring(14, 25);
            appLog('Extracted PESEL:' + identifierNumber);
            if (!validatePESEL(identifierNumber)) {
                displayResult(false, 'Błąd: Nieprawidłowa suma kontrolna numeru PESEL.');
                appLog('Validation failed: PESEL checksum failed.');
                return;
            }
            appLog('PESEL checksum passed.');
            // Krok 5: Weryfikacja zer końcowych dla PESEL
            if (accountNumber[25] !== '0') {
                displayResult(false, 'Błąd: Ostatnia cyfra dla PESEL powinna być zerem.');
                appLog('Validation failed: PESEL trailing zero mismatch.');
                return;
            }
            appLog('PESEL trailing zero check passed.');
        } else if (identifierTypeIndicator === '2') {
            // NIP
            identifierType = 'NIP';
            identifierNumber = accountNumber.substring(14, 24);
            appLog('Extracted NIP:' + identifierNumber);
            if (!validateNIP(identifierNumber)) {
                displayResult(false, 'Błąd: Nieprawidłowa suma kontrolna numeru NIP.');
                appLog('Validation failed: NIP checksum failed.');
                return;
            }
            appLog('NIP checksum passed.');
            // Krok 5: Weryfikacja zer końcowych dla NIP
            if (accountNumber.substring(24, 26) !== '00') {
                displayResult(false, 'Błąd: Ostatnie dwie cyfry dla NIP powinny być zerami.');
                appLog('Validation failed: NIP trailing zeros mismatch.');
                return;
            }
            appLog('NIP trailing zeros check passed.');
        } else {
            displayResult(false, 'Błąd: Nieprawidłowy wskaźnik typu identyfikatora (musi być 1 dla PESEL lub 2 dla NIP).');
            appLog('Validation failed: Invalid identifier type indicator.');
            return;
        }

        // Walidacja zakończona sukcesem
        displayResult(true, 'Numer mikrorachunku jest poprawny.', { type: identifierType, number: identifierNumber });
        appLog('Validation successful!');
    }

    function validatePESEL(pesel) {
        if (pesel.length !== 11) return false;
        const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(pesel[i]) * weights[i];
        }
        const controlDigit = (10 - (sum % 10)) % 10;
        appLog('PESEL:' + pesel + ' Calculated control digit:' + controlDigit + ' Actual control digit:' + parseInt(pesel[10]));
        return controlDigit === parseInt(pesel[10]);
    }

    function validateNIP(nip) {
        if (nip.length !== 10) return false;
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(nip[i]) * weights[i];
        }
        const controlDigit = sum % 11;
        appLog('NIP:' + nip + ' Calculated control digit:' + controlDigit + ' Actual control digit:' + parseInt(nip[9]));
        return controlDigit === parseInt(nip[9]);
    }
});
