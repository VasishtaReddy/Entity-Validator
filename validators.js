// Validators for Entity PEFT Adapter Training Data

// Common words that should be ignored in various validation checks
const COMMON_WORDS_WHITELIST = [
    "customer", "entity", "using", "with", "constrains", "from", "where", "having"
];

// Helper function to find the line number where a string appears in the text
function findLineNumber(text, searchString) {
    if (!text || !searchString) return null;
    
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchString)) {
            return i + 1; // +1 because array is 0-indexed but lines start at 1
        }
    }
    return null;
}

// Helper function to get all entity blocks
function getEntityBlocks(text) {
    const entityBlocks = [];
    const entityDefinitions = [];
    // Regex to find lines starting with "EntityName has ..."
    const entityDefRegex = /^([A-Z][a-zA-Z0-9_]+) has .+$/gm;
    let match;
    while ((match = entityDefRegex.exec(text)) !== null) {
        entityDefinitions.push({
            name: match[1], // Entity name
            startIndex: match.index,
            lineContent: match[0]
        });
    }

    for (let i = 0; i < entityDefinitions.length; i++) {
        const currentDef = entityDefinitions[i];
        const nextDef = entityDefinitions[i + 1];
        // Determine the end index of the current entity's block
        const endIndex = nextDef ? nextDef.startIndex : text.length;
        const blockText = text.substring(currentDef.startIndex, endIndex);
        const firstLineOfBlock = blockText.split('\n')[0].trim();
        
        entityBlocks.push({
            entityName: currentDef.name,
            blockText: blockText,
            // Use the first actual line content of the block for line number finding, which is more robust
            startLine: findLineNumber(text, firstLineOfBlock) 
        });
    }
    return entityBlocks;
}

const validators = {
    // JSON Structure Validators
    V001: {
        id: "V001",
        description: "Must have both input and output fields",
        section: "Required Format",
        validate: function(data) {
            if (!data.input || !data.output) {
                return { 
                    passed: false, 
                    details: "JSON must contain both 'input' and 'output' fields",
                    line: 1 // Root level issue
                };
            }
            return { passed: true };
        }
    },
    
    V002: {
        id: "V002",
        description: "Input must be non-empty string",
        section: "Required Format",
        validate: function(data) {
            if (typeof data.input !== 'string' || data.input.trim() === '') {
                return { 
                    passed: false, 
                    details: "The 'input' field must be a non-empty string",
                    line: 1 // Root level issue
                };
            }
            return { passed: true };
        }
    },
    
    V003: {
        id: "V003",
        description: "Output must be non-empty string",
        section: "Required Format",
        validate: function(data) {
            if (typeof data.output !== 'string' || data.output.trim() === '') {
                return { 
                    passed: false, 
                    details: "The 'output' field must be a non-empty string",
                    line: 1 // Root level issue
                };
            }
            return { passed: true };
        }
    },
    
    V004: {
        id: "V004",
        description: "Output structure must be properly defined",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            // Check if there's at least one entity definition
            const entityDefRegex = /[A-Z][a-zA-Z]+ has [a-zA-Z]/;
            if (!entityDefRegex.test(output)) {
                return { 
                    passed: false, 
                    details: "No entity definitions found. Each entity should start with 'EntityName has attribute...'",
                    line: 1 // First line of output 
                };
            }
            return { passed: true };
        }
    },
    
    // Entity Structure Validators
    V010: {
        id: "V010",
        description: "Entity names must be PascalCase",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            // Only look for entity definitions at the start of lines (not in references or text)
            const entityDefLines = output.split('\n').filter(line => /^[A-Za-z]+ has /.test(line));
            
            const invalidEntities = [];
            const lines = [];
            
            for (const line of entityDefLines) {
                const entityName = line.split(' has ')[0];
                
                // Skip if it's in our whitelist
                if (COMMON_WORDS_WHITELIST.includes(entityName.toLowerCase())) {
                    continue;
                }
                
                // PascalCase check: first letter capital, no underscores, subsequent capitals allowed
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
                    invalidEntities.push(entityName);
                    const lineNumber = findLineNumber(output, line);
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (invalidEntities.length > 0) {
                return { 
                    passed: false, 
                    details: `The following entity names are not in PascalCase: ${invalidEntities.join(', ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    },
    
    V011: {
        id: "V011",
        description: "Attributes must be camelCase",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            
            // Extract attributes from entity definitions - only the first line after "Entity has"
            const entityLines = output.split('\n').filter(line => /^[A-Z][a-zA-Z]+ has /.test(line));
            const invalidAttributes = [];
            const lineNumbers = [];
            
            for (let i = 0; i < entityLines.length; i++) {
                const line = entityLines[i];
                const entityPart = line.split(' has ')[0];
                const attributesPart = line.split(' has ')[1];
                
                // Parse comma-separated attributes, handling special notations
                const attributes = attributesPart.split(/,\s*/).map(attr => attr.trim());
                
                for (const attr of attributes) {
                    // Skip attributes that have enum values (contain parentheses)
                    if (attr.includes('(')) continue;
                    
                    // Extract the attribute name without any markers (^PK, ^FK, [derived])
                    const baseAttrMatch = attr.match(/^([a-zA-Z0-9]+)(\^PK|\^FK|\[derived\])?/);
                    
                    if (baseAttrMatch && baseAttrMatch[1]) {
                        const attrName = baseAttrMatch[1];
                        // Skip empty, has, and annotations
                        if (!attrName || attrName === 'has') continue;
                        
                        // camelCase check: first letter lowercase, no underscores, subsequent capitals allowed
                        if (!/^[a-z][a-zA-Z0-9]*$/.test(attrName)) {
                            invalidAttributes.push(`${entityPart}.${attrName}`);
                            const lineNum = output.split('\n').findIndex(l => l.includes(line)) + 1;
                            lineNumbers.push(lineNum);
                        }
                    }
                }
            }
            
            if (invalidAttributes.length > 0) {
                return { 
                    passed: false, 
                    details: `The following attributes are not in camelCase: ${invalidAttributes.join(', ')}`,
                    line: lineNumbers.length > 0 ? lineNumbers[0] : null,
                    lines: lineNumbers
                };
            }
            return { passed: true };
        }
    },
    
    V012: {
        id: "V012",
        description: "Primary keys must be properly marked with ^PK",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            // Check if each entity has at least one primary key
            const entityDefs = output.split('\n\n').filter(block => /^[A-Z][a-zA-Z]+ has/.test(block));
            const entitiesWithoutPK = [];
            
            for (const def of entityDefs) {
                const entityName = def.split(' has ')[0];
                if (!def.includes('^PK')) {
                    entitiesWithoutPK.push(entityName);
                }
            }
            
            if (entitiesWithoutPK.length > 0) {
                return { 
                    passed: false, 
                    details: `The following entities do not have a primary key marked with ^PK: ${entitiesWithoutPK.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    V013: {
        id: "V013",
        description: "Foreign keys must be properly marked with ^FK",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            
            // Extract relationships to check FK references
            const relationships = output.match(/\* [A-Z][a-zA-Z]+ has [a-z-]+-to-[a-z-]+ relationship with [A-Z][a-zA-Z]+ using [A-Z][a-zA-Z]+\.[a-zA-Z]+ to [A-Z][a-zA-Z]+\.[a-zA-Z]+/g) || [];
            
            const missingFKs = [];
            
            for (const rel of relationships) {
                // Extract the FK attribute mentioned in relationship
                const parts = rel.split(' using ');
                if (parts.length !== 2) continue;
                
                const attributeParts = parts[1].split(' to ');
                if (attributeParts.length !== 2) continue;
                
                const sourceAttr = attributeParts[0]; // Format: EntityName.attributeName
                const sourceEntityName = sourceAttr.split('.')[0];
                const sourceAttrName = sourceAttr.split('.')[1];
                
                // Check if this FK attribute is marked in the entity definition
                const entityDef = output.split('\n\n').find(block => block.startsWith(`${sourceEntityName} has`));
                if (entityDef && !entityDef.includes(`${sourceAttrName}^FK`)) {
                    missingFKs.push(sourceAttr);
                }
            }
            
            if (missingFKs.length > 0) {
                return { 
                    passed: false, 
                    details: `The following foreign key attributes are not marked with ^FK: ${missingFKs.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    V014: {
        id: "V014",
        description: "Derived attributes must be marked with [derived]",
        section: "Entity Definition",
        validate: function(data) {
            const output = data.output;
            
            // Check for calculated fields
            const calculatedFields = output.match(/CalculatedField for ([A-Z][a-zA-Z]+)\.([a-zA-Z]+):/g) || [];
            
            const missingDerivedMarkers = [];
            
            for (const field of calculatedFields) {
                const matches = field.match(/CalculatedField for ([A-Z][a-zA-Z]+)\.([a-zA-Z]+):/);
                if (matches && matches.length === 3) {
                    const entityName = matches[1];
                    const attrName = matches[2];
                    
                    // Check if this attribute is marked as derived in the entity definition
                    const entityDef = output.split('\n\n').find(block => block.startsWith(`${entityName} has`));
                    if (entityDef && !entityDef.includes(`${attrName}[derived]`)) {
                        missingDerivedMarkers.push(`${entityName}.${attrName}`);
                    }
                }
            }
            
            if (missingDerivedMarkers.length > 0) {
                return { 
                    passed: false, 
                    details: `The following calculated attributes are not marked with [derived]: ${missingDerivedMarkers.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Relationship Validators
    V020: {
        id: "V020",
        description: "Relationship types must be valid",
        section: "Relationship Definition",
        validate: function(data) {
            const output = data.output;
            
            // Extract relationships
            const relationships = output.match(/\* [A-Z][a-zA-Z]+ has [a-z-]+-to-[a-z-]+ relationship with/g) || [];
            
            const invalidRelTypes = [];
            
            for (const rel of relationships) {
                const match = rel.match(/has ([a-z-]+-to-[a-z-]+) relationship/);
                if (match && match[1]) {
                    const relType = match[1];
                    if (!['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'].includes(relType)) {
                        invalidRelTypes.push(relType);
                    }
                }
            }
            
            if (invalidRelTypes.length > 0) {
                return { 
                    passed: false, 
                    details: `Invalid relationship types found: ${invalidRelTypes.join(', ')}. Valid types are: one-to-one, one-to-many, many-to-one, many-to-many.` 
                };
            }
            return { passed: true };
        }
    },
    
    V021: {
        id: "V021",
        description: "Relationships must reference existing entities and attributes",
        section: "Relationship Definition",
        validate: function(data) {
            const output = data.output;
            
            // Extract entity names
            const entityNames = [];
            const entityDefs = output.match(/^[A-Z][a-zA-Z]+ has/gm) || [];
            for (const def of entityDefs) {
                entityNames.push(def.split(' has')[0]);
            }
            
            // Extract relationships
            const relationships = output.match(/\* [A-Z][a-zA-Z]+ has [a-z-]+-to-[a-z-]+ relationship with [A-Z][a-zA-Z]+ using [A-Z][a-zA-Z]+\.[a-zA-Z]+ to [A-Z][a-zA-Z]+\.[a-zA-Z]+/g) || [];
            
            const invalidRefs = [];
            
            for (const rel of relationships) {
                // Extract entity names from relationship
                const sourceEntity = rel.split(' has ')[0].substring(2); // Remove "* " prefix
                const targetEntity = rel.split(' relationship with ')[1].split(' using ')[0];
                
                // Check if entities exist
                if (!entityNames.includes(sourceEntity)) {
                    invalidRefs.push(`Source entity ${sourceEntity} not defined`);
                }
                if (!entityNames.includes(targetEntity)) {
                    invalidRefs.push(`Target entity ${targetEntity} not defined`);
                }
                
                // Extract attributes
                const attributePart = rel.split(' using ')[1];
                if (attributePart) {
                    const [sourceAttr, targetAttr] = attributePart.split(' to ');
                    const sourceEntityAttr = sourceAttr.split('.')[0];
                    const targetEntityAttr = targetAttr.split('.')[0];
                    
                    // Check if attribute entities match relationship entities
                    if (sourceEntityAttr !== sourceEntity) {
                        invalidRefs.push(`Source attribute entity ${sourceEntityAttr} doesn't match relationship source ${sourceEntity}`);
                    }
                    if (targetEntityAttr !== targetEntity) {
                        invalidRefs.push(`Target attribute entity ${targetEntityAttr} doesn't match relationship target ${targetEntity}`);
                    }
                }
            }
            
            if (invalidRefs.length > 0) {
                return { 
                    passed: false, 
                    details: `Invalid entity/attribute references in relationships: ${invalidRefs.join('; ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Property Validators
    V040: {
        id: "V040",
        description: "Property types must be valid",
        section: "Property Definition",
        validate: function(data) {
            const output = data.output;
            
            // Extract properties
            const properties = output.match(/\* [A-Z][a-zA-Z]+\.[a-zA-Z]+ [A-Z_]+ =/g) || [];
            
            const invalidProperties = [];
            
            for (const prop of properties) {
                const match = prop.match(/\* [A-Z][a-zA-Z]+\.[a-zA-Z]+ ([A-Z_]+) =/);
                if (match && match[1]) {
                    const propType = match[1];
                    if (!['PROPERTY_NAME', 'DEFAULT_VALUE'].includes(propType)) {
                        invalidProperties.push(`${prop.split(' ')[1]}: ${propType}`);
                    }
                }
            }
            
            if (invalidProperties.length > 0) {
                return { 
                    passed: false, 
                    details: `Invalid property types found: ${invalidProperties.join(', ')}. Valid types are: PROPERTY_NAME, DEFAULT_VALUE.` 
                };
            }
            return { passed: true };
        }
    },
    
    // Validation Rules Validators
    V050: {
        id: "V050",
        description: "Validation rules must follow proper format",
        section: "Validation Rules",
        validate: function(data) {
            const output = data.output;
            
            // Extract validation rules (non-BusinessRule format)
            const validationRules = output.match(/\* [A-Z][a-zA-Z]+\.[a-zA-Z]+ must [a-zA-Z ]+/g) || [];
            
            // Check if rules are properly formatted
            const invalidRules = [];
            
            for (const rule of validationRules) {
                // Rule should have format: * Entity.attribute must [validation rule]
                if (!rule.match(/\* [A-Z][a-zA-Z]+\.[a-zA-Z]+ must [a-zA-Z0-9 ]+/)) {
                    invalidRules.push(rule);
                }
            }
            
            if (invalidRules.length > 0) {
                return { 
                    passed: false, 
                    details: `Invalid validation rule format: ${invalidRules.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Business Rules Validators
    V060: {
        id: "V060",
        description: "Business rules must have function sequence numbers",
        section: "Business Rules",
        validate: function(data) {
            const output = data.output;
            
            // Ignore function names with sequence numbers already in the examples
            const functionNamesWithNumbers = (output.match(/##\s+([a-z][a-z_]+_\d+)/g) || [])
                .map(match => match.match(/##\s+([a-z][a-z_]+)_\d+/)[1]);
            
            // Only find the ones that might be actual errors - look for exact pattern match
            const functionNamesMissingNumbers = [];
            const lines = [];
            
            // Complete regex to match function definitions in the expected format
            const functionDefRegex = /##\s+([a-z][a-z_]+)(?!_\d+)/g;
            let match;
            
            while ((match = functionDefRegex.exec(output)) !== null) {
                const functionName = match[1];
                
                // Skip if it has an underscore at the end already (might be intentional)
                if (functionName.endsWith('_')) continue;
                
                // Skip if there's a similar function name with a number already
                if (functionNamesWithNumbers.includes(functionName)) continue;
                
                functionNamesMissingNumbers.push(`## ${functionName}_`);
                const lineNumber = findLineNumber(output, match[0]);
                if (lineNumber) lines.push(lineNumber);
            }
            
            if (functionNamesMissingNumbers.length > 0) {
                return { 
                    passed: false, 
                    details: `Business rule functions missing sequence numbers: ${functionNamesMissingNumbers.join(', ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    },
    
    V061: {
        id: "V061",
        description: "Business rules must use approved system functions",
        section: "Business Rules",
        validate: function(data) {
            const output = data.output;
            
            // List of approved system functions
            const approvedFunctions = [
                'validate_pattern', 'validate_required', 'compare', 'entity_exists', 
                'validate_date_range', 'enum_check', 'fetch', 'fetch_records', 
                'update', 'create', 'fetch_sum', 'add', 'subtract', 'multiply', 
                'divide', 'calculate_percentage', 'array_functions', 'conditional_logic'
            ];
            
            // Extract business rule operations
            const operations = output.match(/\*Operation: [^*]+\*/g) || [];
            
            const unapprovedFunctions = [];
            const lineNumbers = [];
            
            for (const operation of operations) {
                // Extract function names from operation
                const functionMatches = operation.match(/([a-z_]+)\(/g) || [];
                
                for (const funcMatch of functionMatches) {
                    const functionName = funcMatch.substring(0, funcMatch.length - 1); // Remove trailing (
                    if (!approvedFunctions.includes(functionName)) {
                        unapprovedFunctions.push(functionName);
                        const lineNumber = findLineNumber(output, operation);
                        if (lineNumber) lineNumbers.push(lineNumber);
                    }
                }
            }
            
            if (unapprovedFunctions.length > 0) {
                return { 
                    passed: false, 
                    details: `Unapproved functions used in business rules: ${[...new Set(unapprovedFunctions)].join(', ')}`,
                    line: lineNumbers.length > 0 ? lineNumbers[0] : null,
                    lines: lineNumbers
                };
            }
            return { passed: true };
        }
    },
    
    V062: {
        id: "V062",
        description: "Business rules must specify validation/trigger type",
        section: "Business Rules",
        validate: function(data) {
            const output = data.output;
            
            // Updated regex to correctly parse business rule function blocks.
            // This matches from "## function_name_1" up to the start of the next "## function_name_1" or end of string.
            const businessRuleFunctionBlocks = output.match(/##\s+[a-z_]+_\d+[\s\S]*?(?=(##\s+[a-z_]+_\d+|$))/g) || [];
            
            const missingValidationTrigger = [];
            
            for (const block of businessRuleFunctionBlocks) {
                if (!block.includes('*Validation:') && !block.includes('*Trigger:')) {
                    const functionNameMatch = block.match(/##\s+([a-z_]+_\d+)/); // Extract name from the current block
                    if (functionNameMatch && functionNameMatch[1]) {
                        missingValidationTrigger.push(functionNameMatch[1]);
                    } else {
                        // This path should ideally not be hit if blocks are correctly identified
                        missingValidationTrigger.push('Unknown function (error in block parsing)'); 
                    }
                }
            }
            
            if (missingValidationTrigger.length > 0) {
                return { 
                    passed: false, 
                    details: `Business rules missing validation/trigger specification: ${missingValidationTrigger.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Calculated Fields Validators
    V070: {
        id: "V070",
        description: "Calculated fields must have formula, logic layer, and dependencies",
        section: "Calculated Fields",
        validate: function(data) {
            const output = data.output;
            
            // Extract calculated field blocks with more specific pattern
            const calculatedFieldBlocks = output.match(/CalculatedField for [A-Z][a-zA-Z]+\.[a-zA-Z]+:[^C]*?(\n\n|\n*$)/g) || [];
            
            const incompleteFields = [];
            const lines = [];
            
            for (const block of calculatedFieldBlocks) {
                const entityAttr = block.match(/CalculatedField for ([A-Z][a-zA-Z]+\.[a-zA-Z]+):/);
                let fieldName = 'Unknown field';
                if (entityAttr && entityAttr[1]) {
                    fieldName = entityAttr[1];
                }
                
                const missingParts = [];
                if (!block.includes('* Formula:')) missingParts.push('Formula');
                if (!block.includes('* Logic Layer:')) missingParts.push('Logic Layer');
                if (!block.includes('* Dependencies:')) missingParts.push('Dependencies');
                
                if (missingParts.length > 0) {
                    incompleteFields.push(`${fieldName} missing: ${missingParts.join(', ')}`);
                    const lineNumber = findLineNumber(output, `CalculatedField for ${fieldName}:`);
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (incompleteFields.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete calculated field definitions: ${incompleteFields.join('; ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    },
    
    // Entity Additional Properties Validators (Enhanced for Coverage and Completeness)
    V080: {
        id: "V080",
        description: "Each entity must have its 'Entity Additional Properties' defined, and these properties must be complete.",
        section: "Entity Additional Properties",
        validate: function(data) {
            const output = data.output;
            const allEntityBlocksDetails = getEntityBlocks(output); 
            
            const entitiesMissingProps = [];
            const incompletePropsDetails = [];
            let firstErrorLine = null;

            if (allEntityBlocksDetails.length === 0 && output.match(/^[A-Z][a-zA-Z0-9_]+ has /m)) {
                 return { 
                    passed: false, 
                    details: "Could not parse entity blocks, but entity definitions seem to exist. Check formatting around entity definitions.",
                    line: 1
                };
            }

            for (const entityDetail of allEntityBlocksDetails) {
                const { entityName, blockText, startLine } = entityDetail;
                
                const eapRegex = /Entity Additional Properties:([\s\\S]*?)(?=\\n(?:Attribute Additional Properties:|Relationship Properties:|Relationship:|\\* Synthetic:|\\* Confidential:|\\* Internal:|\\* Public:|\\* Loading for:|\\* Workflow:|\\* Archive Strategy for|\\* Purge Rule for|\\* History Tracking for|BusinessRule Placement:|\\* Entity Placement for|CalculatedField for|BusinessRule for)|##|\\n\\n|$)/m;
                const eapMatch = blockText.match(eapRegex);

                if (!eapMatch) {
                    entitiesMissingProps.push(`${entityName} (defined around line ${startLine})`);
                    if (!firstErrorLine) firstErrorLine = startLine;
                } else {
                    const eapBlockContent = eapMatch[1]; 
                    const eapBlockHeader = eapMatch[0].split('\n')[0];
                    const eapLineInOutput = findLineNumber(output, eapBlockHeader);

                    const missingParts = [];
                    if (!eapBlockContent.includes('Display Name:')) missingParts.push('Display Name');
                    if (!eapBlockContent.includes('Type:')) missingParts.push('Type');
                    if (!eapBlockContent.includes('Description:')) missingParts.push('Description');
                    
                    if (missingParts.length > 0) {
                        incompletePropsDetails.push(`Entity Additional Properties for ${entityName} (section around line ${eapLineInOutput}) is missing: ${missingParts.join(', ')}`);
                        if (!firstErrorLine) firstErrorLine = eapLineInOutput;
                    }
                }
            }
            
            let combinedDetails = "";
            if (entitiesMissingProps.length > 0) {
                combinedDetails += `Entities missing 'Entity Additional Properties' section: ${entitiesMissingProps.join('; ')}. `;
            }
            if (incompletePropsDetails.length > 0) {
                combinedDetails += `Incomplete 'Entity Additional Properties' sections found: ${incompletePropsDetails.join('; ')}.`;
            }

            if (combinedDetails) {
                return { 
                    passed: false, 
                    details: combinedDetails.trim(),
                    line: firstErrorLine
                };
            }
            return { passed: true };
        }
    },
    
    // Attribute Additional Properties Validators (Enhanced for Coverage and Completeness)
    V090: {
        id: "V090",
        description: "Each attribute must have its 'Attribute Additional Properties' defined, and these properties must be complete.",
        section: "Attribute Additional Properties",
        validate: function(data) {
            const output = data.output;
            const allEntityBlocksDetails = getEntityBlocks(output);

            const attributesMissingProps = [];
            const incompleteAttrPropsDetails = [];
            let firstErrorLine = null;

            if (allEntityBlocksDetails.length === 0 && output.match(/^[A-Z][a-zA-Z0-9_]+ has /m)) {
                 return { 
                    passed: false, 
                    details: "Could not parse entity blocks for attribute property checking. Check formatting around entity definitions.",
                    line: 1
                };
            }

            for (const entityDetail of allEntityBlocksDetails) {
                const { entityName, blockText, startLine } = entityDetail;

                const entityDefLineMatch = blockText.match(/^([A-Z][a-zA-Z0-9_]+) has ([^\\n]+)\\.?$/m);
                if (!entityDefLineMatch || !entityDefLineMatch[2]) continue;
                
                const attributesString = entityDefLineMatch[2];
                const definedAttributesFull = attributesString.split(/,\\s*/).map(attr => attr.trim());
                const definedBaseAttributeNames = definedAttributesFull.map(attr => {
                    return attr.split('(')[0].split('^')[0].split('[')[0].trim();
                }).filter(name => name && name.toLowerCase() !== 'has' && name.length > 0);

                const aapBlocksFoundInEntityScope = [];
                const aapRegexGlobal = /Attribute Additional Properties:([\s\\S]*?)(?=\\n(?:Attribute Additional Properties:|Relationship Properties:|Relationship:|\\* Synthetic:|\\* Confidential:|\\* Internal:|\\* Public:|\\* Loading for:|\\* Workflow:|\\* Archive Strategy for|\\* Purge Rule for|\\* History Tracking for|BusinessRule Placement:|\\* Entity Placement for|CalculatedField for|BusinessRule for)|##|\\n\\n|$)/g;
                let aapMatch;
                while ((aapMatch = aapRegexGlobal.exec(blockText)) !== null) {
                    const aapBlockContent = aapMatch[1];
                    const aapBlockHeader = aapMatch[0].split('\n')[0];
                    const aapLineInOutput = findLineNumber(output, aapBlockHeader.trim());
                    const attrNameMatch = aapBlockContent.match(/Attribute name:\\s*([a-zA-Z0-9_]+)/);
                    const actualAttrNameInBlock = attrNameMatch ? attrNameMatch[1] : null;
                    aapBlocksFoundInEntityScope.push({ name: actualAttrNameInBlock, content: aapBlockContent, line: aapLineInOutput });
                }

                const foundAttrNamesWithPropsInScope = new Set(aapBlocksFoundInEntityScope.map(b => b.name).filter(n => n));
                for (const baseAttrName of definedBaseAttributeNames) {
                    if (!foundAttrNamesWithPropsInScope.has(baseAttrName)) {
                        attributesMissingProps.push(`${entityName}.${baseAttrName} (attribute of entity defined around line ${startLine})`);
                        if(!firstErrorLine) firstErrorLine = startLine;
                    }
                }

                for (const aap of aapBlocksFoundInEntityScope) {
                    const missingParts = [];
                    if (!aap.content.includes('Key:')) missingParts.push('Key');
                    if (!aap.content.includes('Display Name:')) missingParts.push('Display Name');
                    if (!aap.content.includes('Data Type:')) missingParts.push('Data Type');
                    if (!aap.content.includes('Type:')) missingParts.push('Type');
                    if (!aap.content.includes('Description:')) missingParts.push('Description');
                    
                    if (missingParts.length > 0) {
                        const ident = aap.name ? `${entityName}.${aap.name}` : `An unnamed Attribute Additional Properties block`;
                        incompleteAttrPropsDetails.push(`${ident} (section around line ${aap.line}) is missing: ${missingParts.join(', ')}`);
                        if(!firstErrorLine && aap.line) firstErrorLine = aap.line;
                    }
                }
            }

            let combinedDetails = "";
            if (attributesMissingProps.length > 0) {
                combinedDetails += `Attributes missing 'Attribute Additional Properties' section: ${attributesMissingProps.join('; ')}. `;
            }
            if (incompleteAttrPropsDetails.length > 0) {
                combinedDetails += `Incomplete 'Attribute Additional Properties' sections found: ${incompleteAttrPropsDetails.join('; ')}.`;
            }

            if (combinedDetails) {
                return { 
                    passed: false, 
                    details: combinedDetails.trim(),
                    line: firstErrorLine
                };
            }
            return { passed: true };
        }
    },
    
    // Relationship Properties Validators
    V100: {
        id: "V100",
        description: "Relationship properties must be properly defined",
        section: "Relationship Properties",
        validate: function(data) {
            const output = data.output;
            
            // Extract relationship property blocks with more specific pattern
            const relPropBlocks = output.match(/Relationship Properties:(\s*\n[^A|R].*)*?(\n\n|\n*$)/g) || [];
            
            const incompleteBlocks = [];
            const lines = [];
            
            for (const block of relPropBlocks) {
                // Extract the relationship identifier if possible
                const relationshipMatch = block.match(/Relationship: ([A-Za-z]+ to [A-Za-z]+)/) || 
                                        output.match(new RegExp(`Relationship:[^\\n]*?(?=\\n*Relationship Properties:${block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`));
                
                let blockIdentifier = relationshipMatch && relationshipMatch[1] ? 
                                     `Relationship properties for ${relationshipMatch[1]}` : 
                                     'Relationship properties';
                
                const missingParts = [];
                if (!block.includes('On Delete:')) missingParts.push('On Delete');
                if (!block.includes('On Update:')) missingParts.push('On Update');
                if (!block.includes('Foreign Key Type:')) missingParts.push('Foreign Key Type');
                
                if (missingParts.length > 0) {
                    incompleteBlocks.push(`${blockIdentifier} missing: ${missingParts.join(', ')}`);
                    const lineNumber = findLineNumber(output, 'Relationship Properties:');
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (incompleteBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete relationship properties: ${incompleteBlocks.join('; ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    },
    
    // Sample Data Validators
    V110: {
        id: "V110",
        description: "Sample data must be syntactically correct",
        section: "Sample Data",
        validate: function(data) {
            const output = data.output;
            
            // Extract synthetic data blocks
            const syntheticBlocks = output.match(/\* Synthetic:[^*]*/g) || [];
            
            const invalidBlocks = [];
            
            for (const block of syntheticBlocks) {
                const sampleDataLines = block.split('\n').filter(line => line.trim() !== '' && !line.includes('* Synthetic:'));
                
                for (const line of sampleDataLines) {
                    // Check basic format: EntityName has attr1 = value1, attr2 = value2, ...
                    if (!line.match(/[A-Z][a-zA-Z]+ has [a-zA-Z]+ = .+/)) {
                        invalidBlocks.push(line);
                    }
                }
            }
            
            if (invalidBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Invalid synthetic data format: ${invalidBlocks.join('; ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Data Classification Validators
    V120: {
        id: "V120",
        description: "Data classification must be properly defined",
        section: "Data Classification",
        validate: function(data) {
            const output = data.output;
            
            // Extract classification blocks
            const classificationTypes = ['Confidential', 'Internal', 'Public'];
            let missingClassifications = [];
            
            // Get all entity names
            const entityNames = [];
            const entityDefs = output.match(/^[A-Z][a-zA-Z]+ has/gm) || [];
            for (const def of entityDefs) {
                entityNames.push(def.split(' has')[0]);
            }
            
            // Check each entity has classifications
            for (const entity of entityNames) {
                const entityHasClassifications = classificationTypes.some(type => 
                    output.includes(`* ${type}: ${entity}.`)
                );
                
                if (!entityHasClassifications) {
                    missingClassifications.push(entity);
                }
            }
            
            if (missingClassifications.length > 0) {
                return { 
                    passed: false, 
                    details: `The following entities are missing data classifications: ${missingClassifications.join(', ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Workflow Validators
    V130: {
        id: "V130",
        description: "Workflow definitions must be properly structured",
        section: "Workflow",
        validate: function(data) {
            const output = data.output;
            
            // Extract workflow blocks
            const workflowBlocks = output.match(/\* Workflow: [a-zA-Z]+ for [A-Z][a-zA-Z]+[^*]*/g) || [];
            
            const incompleteWorkflows = [];
            
            for (const block of workflowBlocks) {
                const workflowMatch = block.match(/\* Workflow: ([a-zA-Z]+) for ([A-Z][a-zA-Z]+)/);
                let workflowName = 'Unknown workflow';
                if (workflowMatch && workflowMatch.length >= 3) {
                    workflowName = `${workflowMatch[1]} for ${workflowMatch[2]}`;
                }
                
                const missingParts = [];
                if (!block.includes('- States:')) missingParts.push('States');
                if (!block.includes('- Transitions:')) missingParts.push('Transitions');
                if (!block.includes('- Actions:')) missingParts.push('Actions');
                
                if (missingParts.length > 0) {
                    incompleteWorkflows.push(`${workflowName} missing: ${missingParts.join(', ')}`);
                }
            }
            
            if (incompleteWorkflows.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete workflow definitions: ${incompleteWorkflows.join('; ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Archive Strategy Validators  
    V140: {
        id: "V140",
        description: "Archive strategy must be properly defined",
        section: "Archive & Purge",
        validate: function(data) {
            const output = data.output;
            
            // Extract archive strategy blocks
            const archiveBlocks = output.match(/\* Archive Strategy for [A-Z][a-zA-Z]+:[^*]*/g) || [];
            
            const incompleteBlocks = [];
            
            for (const block of archiveBlocks) {
                const archiveMatch = block.match(/\* Archive Strategy for ([A-Z][a-zA-Z]+):/);
                let entityName = 'Unknown entity';
                if (archiveMatch && archiveMatch[1]) {
                    entityName = archiveMatch[1];
                }
                
                const missingParts = [];
                if (!block.includes('- Trigger:')) missingParts.push('Trigger');
                if (!block.includes('- Criteria:')) missingParts.push('Criteria');
                if (!block.includes('- Retention:')) missingParts.push('Retention');
                if (!block.includes('- Storage:')) missingParts.push('Storage');
                
                if (missingParts.length > 0) {
                    incompleteBlocks.push(`${entityName} archive strategy missing: ${missingParts.join(', ')}`);
                }
            }
            
            if (incompleteBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete archive strategies: ${incompleteBlocks.join('; ')}` 
                };
            }
            return { passed: true };
        }
    },
    
    // Purge Rule Validators
    V150: {
        id: "V150",
        description: "Purge rule must be properly defined",
        section: "Archive & Purge",
        validate: function(data) {
            const output = data.output;
            
            // Extract purge rule blocks with more specific pattern
            const purgeBlocks = output.match(/\* Purge Rule for [A-Z][a-zA-Z]+:(\s*\n[^*].*)*?(\n\n|\n\*|\n*$)/g) || [];
            
            const incompleteBlocks = [];
            const lines = [];
            
            for (const block of purgeBlocks) {
                const purgeMatch = block.match(/\* Purge Rule for ([A-Z][a-zA-Z]+):/);
                let entityName = purgeMatch && purgeMatch[1] ? purgeMatch[1] : 'Unknown entity';
                
                const missingParts = [];
                if (!block.includes('- Trigger:')) missingParts.push('Trigger');
                if (!block.includes('- Criteria:')) missingParts.push('Criteria');
                if (!block.includes('- Approvals:')) missingParts.push('Approvals');
                if (!block.includes('- Audit:')) missingParts.push('Audit');
                
                if (missingParts.length > 0) {
                    incompleteBlocks.push(`${entityName} purge rule missing: ${missingParts.join(', ')}`);
                    const lineNumber = findLineNumber(output, `* Purge Rule for ${entityName}:`);
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (incompleteBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete purge rules: ${incompleteBlocks.join('; ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    }
};

// Add more validators by section
const validatorsBySection = {
    "Required Format": ["V001", "V002", "V003"],
    "Entity Definition": ["V004", "V010", "V011", "V012", "V013", "V014"],
    "Relationship Definition": ["V020", "V021"],
    "Property Definition": ["V040"],
    "Validation Rules": ["V050"],
    "Business Rules": ["V060", "V061", "V062"],
    "Calculated Fields": ["V070"],
    "Entity Additional Properties": ["V080"],
    "Attribute Additional Properties": ["V090"],
    "Relationship Properties": ["V100"],
    "Sample Data": ["V110"],
    "Data Classification": ["V120"],
    "Workflow": ["V130"],
    "Archive & Purge": ["V140", "V150"]
};

// Function to run all validators
function runAllValidators(data) {
    // Fix any syntax errors
    fixValidatorSyntax();
    
    const results = [];
    let passCount = 0;
    let failCount = 0;
    
    // Run all validators
    for (const section in validatorsBySection) {
        for (const validatorId of validatorsBySection[section]) {
            const validator = validators[validatorId];
            if (validator) {
                try {
                    const result = validator.validate(data);
                    results.push({
                        id: validator.id,
                        description: validator.description,
                        section: validator.section,
                        passed: result.passed,
                        details: result.details || 'Validation passed',
                        line: result.line || null,
                        lines: result.lines || []
                    });
                    
                    if (result.passed) {
                        passCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    results.push({
                        id: validator.id,
                        description: validator.description,
                        section: validator.section,
                        passed: false,
                        details: `Validator error: ${error.message}`,
                        line: null
                    });
                    failCount++;
                }
            }
        }
    }
    
    return {
        validationResults: results,
        summary: {
            total: passCount + failCount,
            pass: passCount,
            fail: failCount,
            passRate: Math.round((passCount / (passCount + failCount)) * 100)
        }
    };
}

// Export validators
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validators,
        validatorsBySection,
        runAllValidators
    };
} 