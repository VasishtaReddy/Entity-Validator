document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const jsonInput = document.getElementById('json-input');
    const validateBtn = document.getElementById('validate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const sampleBtn = document.getElementById('sample-btn');
    const fileUpload = document.getElementById('file-upload');
    const downloadLogBtn = document.getElementById('download-log');
    const resultStatus = document.getElementById('result-status');
    const validationResults = document.getElementById('validation-results');
    const validationTypeSelect = document.getElementById('validationType');

    // Global variable to store validation results for download
    let currentValidationResult = null;

    // Event Listeners
    validateBtn.addEventListener('click', runValidation);
    clearBtn.addEventListener('click', clearAll);
    sampleBtn.addEventListener('click', loadSample);
    fileUpload.addEventListener('change', handleFileUpload);
    downloadLogBtn.addEventListener('click', downloadErrorLog);

    // Functions
    function runValidation() {
        alert('runValidation called!'); // Debug: confirm function is triggered
        // Reset validation display
        resultStatus.className = 'pending';
        resultStatus.textContent = 'Validating...';
        validationResults.innerHTML = '';
        downloadLogBtn.classList.add('hidden');

        // Get input
        const input = jsonInput.value.trim();
        if (!input) {
            resultStatus.className = 'fail';
            resultStatus.textContent = 'Error: No JSON provided';
            return;
        }

        let jsonData;
        try {
            jsonData = JSON.parse(input);
        } catch (error) {
            resultStatus.className = 'fail';
            resultStatus.textContent = 'Invalid JSON: ' + error.message;
            return;
        }

        let validationResult;
        if (validationTypeSelect.value === 'entity') {
            validationResult = runAllValidators(jsonData);
        } else if (validationTypeSelect.value === 'tenant') {
            const tenantResults = runTenantValidators(jsonData);
            const passCount = tenantResults.filter(r => r.passed).length;
            const failCount = tenantResults.length - passCount;
            validationResult = {
                validationResults: tenantResults,
                summary: {
                    total: tenantResults.length,
                    pass: passCount,
                    fail: failCount,
                    passRate: tenantResults.length > 0 ? Math.round((passCount / tenantResults.length) * 100) : 100
                }
            };
        } else {
            const goResults = runGOValidators(jsonData);
            const passCount = goResults.filter(r => r.passed).length;
            const failCount = goResults.length - passCount;
            validationResult = {
                validationResults: goResults,
                summary: {
                    total: goResults.length,
                    pass: passCount,
                    fail: failCount,
                    passRate: goResults.length > 0 ? Math.round((passCount / goResults.length) * 100) : 100
                }
            };
        }
        currentValidationResult = validationResult;
        displayResults(validationResult);

        if (validationResult.summary && validationResult.summary.fail > 0) {
            downloadLogBtn.classList.remove('hidden');
        }
    }

    function displayResults(validationResult) {
        // Update summary status
        if (validationResult.summary.fail === 0) {
            resultStatus.className = 'pass';
            resultStatus.textContent = `All validations passed (${validationResult.summary.total}/${validationResult.summary.total})`;
        } else {
            resultStatus.className = 'fail';
            resultStatus.textContent = `${validationResult.summary.fail} validation(s) failed. Pass rate: ${validationResult.summary.passRate}%`;
        }

        // Display detailed results
        const results = validationResult.validationResults;
        
        // Group results by section
        const sectionGroups = {};
        results.forEach(result => {
            if (!sectionGroups[result.section]) {
                sectionGroups[result.section] = [];
            }
            sectionGroups[result.section].push(result);
        });
        
        // Create result rows
        for (const section in sectionGroups) {
            // Add section header
            const sectionRow = document.createElement('tr');
            sectionRow.className = 'section-header';
            sectionRow.innerHTML = `
                <td colspan="4" class="section-name">${section}</td>
            `;
            validationResults.appendChild(sectionRow);
            
            // Add individual validators
            sectionGroups[section].forEach(result => {
                const row = document.createElement('tr');
                
                // Format line numbers for display
                let lineInfo = '';
                if (!result.passed) {
                    if (result.line) {
                        lineInfo = `Line ${result.line}`;
                        if (result.lines && result.lines.length > 1) {
                            lineInfo += ` (and ${result.lines.length - 1} more)`;
                        }
                    }
                }
                
                row.innerHTML = `
                    <td>${result.id}</td>
                    <td>${result.description}</td>
                    <td class="validator-status ${result.passed ? 'pass' : 'fail'}">${result.passed ? 'Pass' : 'Fail'}</td>
                    <td class="details-container">
                        ${result.details}
                        ${lineInfo ? `<div class="line-info">${lineInfo}</div>` : ''}
                    </td>
                `;
                validationResults.appendChild(row);
            });
        }
    }

    function clearAll() {
        jsonInput.value = '';
        resultStatus.className = 'pending';
        resultStatus.textContent = 'Pending validation';
        validationResults.innerHTML = '';
        downloadLogBtn.classList.add('hidden');
        currentValidationResult = null;
    }

    function loadSample() {
        jsonInput.value = JSON.stringify({
            "input": "Create entity structure for loan management system for banking",
            "output": "Loan has loanId^PK, customerId^FK, loanAmount, interestRate, term, startDate, endDate, status (Active, Closed, Default, Restructured), paymentFrequency, totalPaymentsMade, remainingBalance[derived], loanType (Personal, Mortgage, Auto, Education, Business), collateralId^FK, originationFee, lateFeePercentage, earlyPaymentPenalty.\n\n* Loan has many-to-one relationship with Customer using Loan.customerId to Customer.customerId^PK\n* Loan has many-to-one relationship with Collateral using Loan.collateralId to Collateral.collateralId^PK\n* Loan has one-to-many relationship with Payment using Loan.loanId to Payment.loanId^FK\n\n* Loan.minInterestRate PROPERTY_NAME = 1.0\n* Loan.minTerm PROPERTY_NAME = 3\n* Loan.status DEFAULT_VALUE = \"Active\"\n* Loan.startDate DEFAULT_VALUE = CURRENT_DATE\n\n* Loan.loanId must be unique\n* Loan.loanAmount must be greater than 0\n* Loan.interestRate must be greater than or equal to 1.0\n* Loan.term must be greater than or equal to 3\n* Loan.startDate must not be in the future\n* Loan.endDate must be after startDate"
        }, null, 2);
    }
    
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if it's a JSON file
        if (!file.type && !file.name.endsWith('.json')) {
            alert('Please select a JSON file');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // Try to parse to confirm it's valid JSON
                const jsonContent = e.target.result;
                JSON.parse(jsonContent);
                
                // If valid, set the textarea content
                jsonInput.value = jsonContent;
            } catch (error) {
                alert('Invalid JSON file: ' + error.message);
            }
        };
        reader.onerror = function() {
            alert('Error reading file');
        };
        reader.readAsText(file);
        
        // Reset the file input to allow selecting the same file again
        event.target.value = '';
    }
    
    function downloadErrorLog() {
        if (!currentValidationResult) return;
        
        // Create error log content
        let logContent = 'Entity PEFT Adapter JSON Validation Error Log\n';
        logContent += '===========================================\n\n';
        logContent += `Date: ${new Date().toISOString()}\n`;
        logContent += `Summary: ${currentValidationResult.summary.fail} validation(s) failed. `;
        logContent += `Pass rate: ${currentValidationResult.summary.passRate}%\n\n`;
        
        // Add details for each failed validation
        logContent += 'Failed Validations:\n';
        logContent += '-------------------\n\n';
        
        const failedValidations = currentValidationResult.validationResults.filter(
            result => !result.passed
        );
        
        failedValidations.forEach(validation => {
            logContent += `ID: ${validation.id}\n`;
            logContent += `Section: ${validation.section}\n`;
            logContent += `Description: ${validation.description}\n`;
            
            // Add line number information
            if (validation.line) {
                logContent += `Line: ${validation.line}\n`;
                if (validation.lines && validation.lines.length > 1) {
                    logContent += `All Lines: ${validation.lines.join(', ')}\n`;
                }
            }
            
            logContent += `Details: ${validation.details}\n\n`;
        });
        
        // Generate download
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        
        // Create a temporary link to trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `validation-errors-${timestamp}.txt`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Add custom CSS for section headers
    const style = document.createElement('style');
    style.textContent = `
        .section-header {
            background-color: #f2f7fd;
            font-weight: bold;
        }
        .section-name {
            padding: 8px;
            color: #2c3e50;
        }
        .line-info {
            margin-top: 5px;
            font-size: 0.85em;
            color: #e67e22;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
}); 