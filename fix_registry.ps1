$content = Get-Content 'validators.js' -Raw

# Fix VAL008 description
$content = $content -replace 'Application code exists in approved registry', 'Application code follows industry standards'

# Fix VAL021 description  
$content = $content -replace 'System function names exist in the approved registry', 'System function names follow naming conventions'

# Fix comments
$content = $content -replace '// 8\. Application code exists in approved registry', '// 8. Application code follows industry standards'
$content = $content -replace '// 21\. System function names exist in the approved registry', '// 21. System function names follow naming conventions'

Set-Content 'validators.js' -Value $content -NoNewline 