# Entity PEFT Adapter JSON Validator

This web application validates JSON datasets created for Entity PEFT Adapter training according to the structure and requirements outlined in the Entity PEFT Adapter Training Data Guide.

## Features

- Validates JSON structure and content against 40+ validation rules
- Groups validations by category
- Displays detailed error messages with line numbers
- Provides pass/fail summary
- Includes a sample dataset loader
- Supports JSON file upload
- Allows downloading validation error logs with line references

## Validation Rules

The validator checks for:

- Basic JSON structure with input and output fields
- Entity naming conventions (PascalCase for entities, camelCase for attributes)
- Property marker usage (^PK, ^FK, [derived], etc.)
- Relationship definitions
- Property definitions
- Business rule formats
- Calculated field requirements
- Entity and attribute additional properties
- Sample data format
- Data classification requirements
- Workflow definitions
- Archive and purge rule structures

## Usage

1. Open `index.html` in a web browser
2. Paste your JSON dataset into the text area or use the "Upload JSON" button to load a file
3. Click the "Validate" button to run validations
4. View the validation results with error messages and line numbers
5. If there are validation errors, click "Download Error Log" for a detailed report
6. Use the "Load Sample" button to see an example of valid JSON
7. Click "Clear" to reset the form

## Structure

- `index.html`: The main HTML file
- `styles.css`: CSS styling
- `validators.js`: Contains all validation logic
- `app.js`: Main application logic

## Requirements

- Modern web browser with JavaScript enabled
- No server-side components or internet connection required (runs entirely client-side)

## Development

To add new validators:

1. Add a new validator object to the `validators` object in `validators.js`
2. Add the validator ID to the appropriate section in the `validatorsBySection` object
3. The validator should have an `id`, `description`, `section`, and `validate` function that returns an object with `passed`, `details`, and `line` properties

## License

MIT License #   E n t i t y - V a l i d a t o r  
 