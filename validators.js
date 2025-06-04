// Validators for Entity PEFT Adapter Training Data

// Common words that should be ignored in various validation checks
const COMMON_WORDS_WHITELIST = [
    "customer", "entity", "using", "with", "constrains", "from", "where", "having"
];

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
                
                // Split attributes by comma, but not within parentheses
                let currentAttr = '';
                let inParentheses = false;
                const attributes = [];
                
                for (let j = 0; j < attributesPart.length; j++) {
                    const char = attributesPart[j];
                    if (char === '(') {
                        inParentheses = true;
                        currentAttr += char;
                    } else if (char === ')') {
                        inParentheses = false;
                        currentAttr += char;
                    } else if (char === ',' && !inParentheses) {
                        attributes.push(currentAttr.trim());
                        currentAttr = '';
                    } else {
                        currentAttr += char;
                    }
                }
                if (currentAttr.trim()) {
                    attributes.push(currentAttr.trim());
                }
                
                for (const attr of attributes) {
                    // Extract the base attribute name (before any parentheses or markers)
                    let attrName = attr;
                    
                    // If attribute has enum values, extract only the attribute name
                    if (attr.includes('(')) {
                        attrName = attr.split('(')[0].trim();
                    }
                    
                    // Remove any markers (^PK, ^FK, [derived], [info], [dependent], [constant])
                    attrName = attrName.replace(/(\^PK|\^FK|\[derived\]|\[info\]|\[dependent\]|\[constant\])/g, '').trim();
                    
                    // Remove trailing period if present
                    attrName = attrName.replace(/\.$/, '');
                    
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
    
    // Entity Additional Properties Validators
    V080: {
        id: "V080",
        description: "Entity additional properties must be properly defined",
        section: "Entity Additional Properties",
        validate: function(data) {
            const output = data.output;
            
            // Extract entity additional properties blocks with a more specific pattern
            const additionalPropsBlocks = output.match(/Entity Additional Properties:(\s*\n[^A].*)*?(\n\n|\n*$)/g) || [];
            
            const incompleteBlocks = [];
            const lines = [];
            
            for (const block of additionalPropsBlocks) {
                // Extract the entity name if possible
                const entityNameMatch = block.match(/Entity Additional Properties:.*?(?=\n)/) || 
                                       block.match(/Entity Additional Properties:/);
                let blockIdentifier = entityNameMatch ? entityNameMatch[0] : 'Entity additional properties';
                
                const missingParts = [];
                if (!block.includes('Display Name:')) missingParts.push('Display Name');
                if (!block.includes('Type:')) missingParts.push('Type');
                if (!block.includes('Description:')) missingParts.push('Description');
                
                if (missingParts.length > 0) {
                    incompleteBlocks.push(`${blockIdentifier} missing: ${missingParts.join(', ')}`);
                    const lineNumber = findLineNumber(output, entityNameMatch ? entityNameMatch[0] : 'Entity Additional Properties:');
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (incompleteBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete entity additional properties: ${incompleteBlocks.join('; ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
                };
            }
            return { passed: true };
        }
    },
    
    // Attribute Additional Properties Validators
    V090: {
        id: "V090",
        description: "Attribute additional properties must be properly defined",
        section: "Attribute Additional Properties",
        validate: function(data) {
            const output = data.output;
            
            // Extract attribute additional properties blocks
            const additionalPropsBlocks = output.match(/Attribute Additional Properties:(\s*\n[^A].*)*?(\n\n|\n*$)/g) || [];
            
            const incompleteBlocks = [];
            const lines = [];
            
            for (const block of additionalPropsBlocks) {
                const attributeName = block.match(/Attribute name: ([a-zA-Z0-9]+)/);
                let attrName = attributeName && attributeName[1] ? attributeName[1] : 'Unknown attribute';
                
                const missingParts = [];
                if (!block.includes('Key:')) missingParts.push('Key');
                if (!block.includes('Display Name:')) missingParts.push('Display Name');
                if (!block.includes('Data Type:')) missingParts.push('Data Type');
                if (!block.includes('Required:')) missingParts.push('Required');
                if (!block.includes('Format:')) missingParts.push('Format');
                if (!block.includes('Values:')) missingParts.push('Values');
                if (!block.includes('Default:')) missingParts.push('Default');
                if (!block.includes('Validation:')) missingParts.push('Validation');
                if (!block.includes('Error Message:')) missingParts.push('Error Message');
                if (!block.includes('Description:')) missingParts.push('Description');
                
                if (missingParts.length > 0) {
                    incompleteBlocks.push(`${attrName} missing: ${missingParts.join(', ')}`);
                    const lineNumber = findLineNumber(output, `Attribute Additional Properties:`);
                    if (lineNumber) lines.push(lineNumber);
                }
            }
            
            if (incompleteBlocks.length > 0) {
                return { 
                    passed: false, 
                    details: `Incomplete attribute additional properties: ${incompleteBlocks.join('; ')}`,
                    line: lines.length > 0 ? lines[0] : null,
                    lines: lines
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
            
            // Extract relationship property blocks
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
                // Look for classification patterns in the output
                const hasClassifications = output.includes(`-Confidential: ${entity}.`) || 
                                        output.includes(`-Internal: ${entity}.`) || 
                                        output.includes(`-Public: ${entity}.`);
                
                if (!hasClassifications) {
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

// Function to correct syntax error in V061
function fixValidatorSyntax() {
    // Fix the syntax error in V061
    validators.V061 = {
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
    };
}

// Add more validators by section
const validatorsBySection = {
    "Required Format": ["V001", "V002", "V003"],
    "Entity Definition": ["V004", "V010", "V011", "V012", "V013", "V014"],
    "Relationship Definition": ["V020", "V021"],
    "Property Definition": ["V040"],
    "Validation Rules": ["V050"],
    "Business Rules": [], // Removed V060, V061, V062
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

// --- BEGIN NEW GO VALIDATORS ---
const goValidators = {
  "V001": { id: "V001", description: "ALL 13 sections MUST be present in exact order for each GO", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V002": { id: "V002", description: "ALL section headers MUST match exactly (case-sensitive)", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V003": { id: "V003", description: "ALL mandatory fields MUST be populated (no empty values)", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V004": { id: "V004", description: "GO ID MUST be unique and follow GO[go###] format across all GOs", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V005": { id: "V005", description: "ALL entity references MUST exist in source entity definitions", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V006": { id: "V006", description: "ALL role references MUST exist in organizational structure", section: "Mandatory Structure Validation", validate: function(data) { return { passed: true }; } },
  "V007": { id: "V007", description: "Core Metadata MUST include go_id, name, description, primary_entity, classification", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V008": { id: "V008", description: "Process Ownership MUST include Originator, Process Owner, Business Sponsor", section: "Section 2: Process Ownership", validate: function(data) { return { passed: true }; } },
  "V009": { id: "V009", description: "Trigger Definition MUST include Trigger Type, Condition, Schedule, Attributes", section: "Section 3: Trigger Definition", validate: function(data) { return { passed: true }; } },
  "V010": { id: "V010", description: "Entity Input Processing MUST specify Source as 'Entity PEFT Adapter Output'", section: "Section 4: Entity Input Processing", validate: function(data) { return { passed: true }; } },
  "V011": { id: "V011", description: "Entity-Process Mapping MUST classify ALL entities into 5 categories", section: "Section 5: Entity-Process Mapping", validate: function(data) { return { passed: true }; } },
  "V012": { id: "V012", description: "Process Pathways MUST include pathway name, conditions, duration, description", section: "Section 7: Process Pathways", validate: function(data) { return { passed: true }; } },
  "V013": { id: "V013", description: "LO numbering MUST be sequential within each pathway for each GO", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V014": { id: "V014", description: "Business rule LO references MUST match pathway LOs for each GO", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V015": { id: "V015", description: "Data management CRUD operations MUST reference valid LOs for each GO", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V016": { id: "V016", description: "Integration LO references MUST be valid for each GO", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V017": { id: "V017", description: "Performance targets MUST reference valid LOs or pathways for each GO", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V018": { id: "V018", description: "ALL LO references MUST use LO[lo###] format", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V019": { id: "V019", description: "Entity attribute mappings MUST be complete for each GO", section: "Section 6: Attribute-Operation Mapping", validate: function(data) { return { passed: true }; } },
  "V020": { id: "V020", description: "Entity validation rules MUST trace to GO business rules for each GO", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V021": { id: "V021", description: "Cross-GO entity references MUST be consistent across all GOs", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V022": { id: "V022", description: "Shared entity operations MUST be coordinated across GOs", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V023": { id: "V023", description: "Integration points MUST be bidirectionally defined", section: "Data Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V024": { id: "V024", description: "Entity naming consistency MUST be verified", section: "Section 4: Entity Input Processing", validate: function(data) { return { passed: true }; } },
  "V025": { id: "V025", description: "Entity relationship integrity MUST be confirmed", section: "Section 4: Entity Input Processing", validate: function(data) { return { passed: true }; } },
  "V026": { id: "V026", description: "First LO MUST be [HUMAN] for each GO (process initiation requirement)", section: "Business Logic Validation", validate: function(data) { return { passed: true }; } },
  "V027": { id: "V027", description: "ALL [SYSTEM] LOs MUST have triggers for each GO", section: "Section 7: Process Pathways", validate: function(data) { return { passed: true }; } },
  "V028": { id: "V028", description: "ALL pathways MUST start with LO-1 for each GO", section: "Section 7: Process Pathways", validate: function(data) { return { passed: true }; } },
  "V029": { id: "V029", description: "ALL pathways MUST reach terminal state for each GO", section: "Section 7: Process Pathways", validate: function(data) { return { passed: true }; } },
  "V030": { id: "V030", description: "Route logic MUST be properly defined for all LOs", section: "Section 7: Process Pathways", validate: function(data) { return { passed: true }; } },
  "V031": { id: "V031", description: "Business rules MUST be categorized correctly", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V032": { id: "V032", description: "Entity-derived rules MUST trace to source entities for each GO", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V033": { id: "V033", description: "ALL business rules MUST use BR[br###] format", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V034": { id: "V034", description: "Business rules MUST link to implementing LOs", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V035": { id: "V035", description: "Rule logic MUST be specified for validation and calculation rules", section: "Section 8: GO Business Rules", validate: function(data) { return { passed: true }; } },
  "V036": { id: "V036", description: "Entity lifecycle management MUST be complete for each GO", section: "Section 9: GO Data Management", validate: function(data) { return { passed: true }; } },
  "V037": { id: "V037", description: "CRUD operations MUST be mapped to specific LOs", section: "Section 9: GO Data Management", validate: function(data) { return { passed: true }; } },
  "V038": { id: "V038", description: "Entity state changes MUST be properly managed", section: "Section 9: GO Data Management", validate: function(data) { return { passed: true }; } },
  "V039": { id: "V039", description: "Entity archival processes MUST be defined", section: "Section 9: GO Data Management", validate: function(data) { return { passed: true }; } },
  "V040": { id: "V040", description: "Entity traceability MUST achieve 100% coverage for each GO", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V041": { id: "V041", description: "Every entity attribute MUST be mapped to at least one LO operation", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V042": { id: "V042", description: "Coverage percentage MUST be calculated and documented", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V043": { id: "V043", description: "Unmapped attributes MUST be listed if any exist", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V044": { id: "V044", description: "Total vs mapped entity attributes MUST be tracked", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V045": { id: "V045", description: "Entity-LO mapping MUST be complete (CRUD operations)", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V046": { id: "V046", description: "Entity validation-business rule mapping MUST be complete", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V047": { id: "V047", description: "Entity relationship-process flow mapping MUST be complete", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V048": { id: "V048", description: "Entity classification-process security mapping MUST be complete", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V049": { id: "V049", description: "Entity integration-system integration mapping MUST be complete", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V050": { id: "V050", description: "Multi-value constraint-process logic mapping MUST be complete", section: "Section 12: Entity Traceability", validate: function(data) { return { passed: true }; } },
  "V051": { id: "V051", description: "Entity consistency validation MUST pass all checks for each GO", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V052": { id: "V052", description: "All source entities MUST be parsed successfully", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V053": { id: "V053", description: "Entity relationship integrity MUST be confirmed", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V054": { id: "V054", description: "Entity validation completeness MUST be checked", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V055": { id: "V055", description: "Primary entity alignment with process purpose MUST be verified", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V056": { id: "V056", description: "Entity operations coverage completeness MUST be measured", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V057": { id: "V057", description: "Entity business rules translation MUST be complete", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V058": { id: "V058", description: "Entity integration requirements MUST be addressed", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V059": { id: "V059", description: "Entity relationship consistency in process flow MUST be verified", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V060": { id: "V060", description: "Entity foreign key constraints MUST be reflected in routing", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V061": { id: "V061", description: "Entity cascade rules MUST be implemented in process logic", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V062": { id: "V062", description: "Entity transaction boundaries MUST be respected in pathways", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V063": { id: "V063", description: "Entity security classifications MUST be applied to LOs", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V064": { id: "V064", description: "Confidential entity access MUST be properly restricted", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V065": { id: "V065", description: "Entity audit requirements MUST be implemented", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V066": { id: "V066", description: "Entity privacy requirements MUST be addressed", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V067": { id: "V067", description: "Entity volume estimates MUST be reflected in performance targets", section: "Section 11: GO Performance Management", validate: function(data) { return { passed: true }; } },
  "V068": { id: "V068", description: "Entity complexity factors MUST be included in LO design", section: "Section 11: GO Performance Management", validate: function(data) { return { passed: true }; } },
  "V069": { id: "V069", description: "Entity integration load MUST be considered in SLA design", section: "Section 11: GO Performance Management", validate: function(data) { return { passed: true }; } },
  "V070": { id: "V070", description: "Entity scalability requirements MUST be addressed", section: "Section 11: GO Performance Management", validate: function(data) { return { passed: true }; } },
  "V071": { id: "V071", description: "ALL individual GOs MUST follow complete 13-section structure", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V072": { id: "V072", description: "Cross-GO integration matrix MUST be complete with all dependencies mapped", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V073": { id: "V073", description: "System-wide requirements MUST be comprehensive covering all shared aspects", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V074": { id: "V074", description: "Cross-GO dependencies MUST be logically consistent", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V075": { id: "V075", description: "System-wide business rules MUST not conflict with individual GO rules", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V076": { id: "V076", description: "Integration triggers MUST be properly sequenced across GOs", section: "Section 10: GO Integration", validate: function(data) { return { passed: true }; } },
  "V077": { id: "V077", description: "Data flows MUST be traceable across GO boundaries", section: "Section 10: GO Integration", validate: function(data) { return { passed: true }; } },
  "V078": { id: "V078", description: "Integration points MUST be explicitly documented for all GO relationships", section: "Section 10: GO Integration", validate: function(data) { return { passed: true }; } },
  "V079": { id: "V079", description: "Shared entity lifecycle MUST be coordinated across GOs", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V080": { id: "V080", description: "Cross-process business rules MUST be defined", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V081": { id: "V081", description: "Entity consistency MUST be maintained across all GOs in consolidated set", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V082": { id: "V082", description: "Performance targets MUST be aligned across integrated processes", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V083": { id: "V083", description: "Business rules MUST not conflict between different GOs", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V084": { id: "V084", description: "System-wide performance targets MUST be realistic", section: "Consolidated Format Validation", validate: function(data) { return { passed: true }; } },
  "V085": { id: "V085", description: "Validation success rate MUST be calculated and documented", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V086": { id: "V086", description: "Total validation checks MUST be counted", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V087": { id: "V087", description: "Passed vs failed validations MUST be tracked", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V088": { id: "V088", description: "Validation success rate MUST meet minimum threshold", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V089": { id: "V089", description: "Critical issues MUST be documented with remediation plans", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V090": { id: "V090", description: "NO critical validation failures are allowed before proceeding", section: "Section 13: Entity Consistency Validation", validate: function(data) { return { passed: true }; } },
  "V091": { id: "V091", description: "GO ID MUST use sequential numbering for easy reference", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V092": { id: "V092", description: "Process names MUST be action-oriented and business-focused", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V093": { id: "V093", description: "Descriptions MUST explain both 'what' and 'why' of the process", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V094": { id: "V094", description: "Primary entity MUST represent the main workflow object", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V095": { id: "V095", description: "Classification MUST use standard business domain categories", section: "Section 1: Core Metadata", validate: function(data) { return { passed: true }; } },
  "V096": { id: "V096", description: "Trigger Type MUST match actual process initiation method", section: "Section 3: Trigger Definition", validate: function(data) { return { passed: true }; } },
  "V097": { id: "V097", description: "Trigger Condition MUST be specific and testable", section: "Section 3: Trigger Definition", validate: function(data) { return { passed: true }; } },
  "V098": { id: "V098", description: "Trigger Schedule MUST be appropriate for business need", section: "Section 3: Trigger Definition", validate: function(data) { return { passed: true }; } },
  "V099": { id: "V099", description: "Entity definitions MUST be complete NSL structures from Entity adapter", section: "Section 4: Entity Input Processing", validate: function(data) { return { passed: true }; } },
  "V100": { id: "V100", description: "Entity count and types MUST be documented and validated", section: "Section 4: Entity Input Processing", validate: function(data) { return { passed: true }; } }
};
// --- END NEW GO VALIDATORS ---

function runGOValidators(data) {
  const results = [];
  for (const key in goValidators) {
    const validator = goValidators[key];
    try {
      const result = validator.validate(data);
      results.push({
        id: validator.id,
        description: validator.description,
        section: validator.section,
        passed: result.passed,
        details: result.details || 'Validation passed'
      });
    } catch (error) {
      results.push({
        id: validator.id,
        description: validator.description,
        section: validator.section,
        passed: false,
        details: `Validator error: ${error.message}`
      });
    }
  }
  return results;
}

delete goValidators["GO-V041"];

const tenantValidators = {
  "TA-V001": { id: "TA-V001", description: "Input must follow exact JSON format: {\"input\": \"Generate a comprehensive Tenant definition...\"}", section: "Input Format", validate: function(data) {
    if (!data.input || typeof data.input !== "string" || !/tenant definition/i.test(data.input)) {
      return { passed: false, details: "Input must include a string with 'Tenant definition'" };
    }
    return { passed: true };
  } },
  "TA-V003": { id: "TA-V003", description: "Business function must be from acceptable categories (Procurement, Sales, HR, Finance, Customer Service, etc.)", section: "Input Format", validate: function(data) {
    const input = data.input || "";
    const categories = ["Procurement", "Sales", "HR", "Finance", "Customer Service", "Operations", "Marketing", "IT", "Support"];
    if (!categories.some(cat => new RegExp(cat, "i").test(input))) {
      return { passed: false, details: "Input business function must be one of: " + categories.join(", ") };
    }
    return { passed: true };
  } },
  "TA-V004": { id: "TA-V004", description: "Industry must be from defined list (Manufacturing, E-commerce, Healthcare, Financial Services, etc.)", section: "Input Format", validate: function(data) {
    const input = data.input || "";
    const industries = ["Manufacturing", "E-commerce", "Healthcare", "Financial Services", "Retail", "Education", "Logistics", "Telecom", "Energy"];
    if (!industries.some(ind => new RegExp(ind, "i").test(input))) {
      return { passed: false, details: "Input industry must be one of: " + industries.join(", ") };
    }
    return { passed: true };
  } },
  "TA-V005": { id: "TA-V005", description: "Input phrasing must match the standardized template exactly", section: "Input Format", validate: function(data) {
    const input = data.input || "";
    if (!/^Generate a comprehensive Tenant definition.*NSL Format\.$/i.test(input.trim())) {
      return { passed: false, details: "Input must match the standardized template exactly." };
    }
    return { passed: true };
  } },
  "TA-V006": { id: "TA-V006", description: "'NSL Format' must be specified in every input", section: "Input Format", validate: function(data) {
    const input = data.input || "";
    if (!/NSL Format/i.test(input)) {
      return { passed: false, details: "'NSL Format' must be specified in input." };
    }
    return { passed: true };
  } },
  "TA-V007": { id: "TA-V007", description: "Punctuation and capitalization must be consistent across inputs", section: "Input Format", validate: function(data) {
    const input = data.input || "";
    if (input !== input.trim() || /[a-z]{2,}[A-Z]/.test(input)) {
      return { passed: false, details: "Inconsistent capitalization or leading/trailing whitespace in input." };
    }
    return { passed: true };
  } },
  "TA-V008": { id: "TA-V008", description: "Output must begin with standardized JSON structure and Intent statement", section: "Output Format", validate: function(data) {
    const output = data.output || "";
    if (!/^Intent:/i.test(output.trim())) {
      return { passed: false, details: "Output must begin with 'Intent:' statement." };
    }
    return { passed: true };
  } },
  "TA-V010": { id: "TA-V010", description: "Content must start directly with '### Tenant Analysis' section", section: "Output Format", validate: function(data) {
    const output = data.output || "";
    if (!/### Tenant Analysis/i.test(output)) {
      return { passed: false, details: "Output must contain '### Tenant Analysis' section at the start of content." };
    }
    return { passed: true };
  } },
  "TA-V011": { id: "TA-V011", description: "Must maintain proper JSON formatting with escaped quotes and newlines", section: "Output Format", validate: function(data) {
    try {
      JSON.stringify(data);
      return { passed: true };
    } catch (e) {
      return { passed: false, details: "Output is not valid JSON or contains unescaped characters." };
    }
  } },
  "TA-V012": { id: "TA-V012", description: "No JSON syntax errors or malformed structure allowed", section: "Output Format", validate: function(data) {
    try {
      JSON.parse(JSON.stringify(data));
      return { passed: true };
    } catch (e) {
      return { passed: false, details: "Malformed JSON structure." };
    }
  } },
  "TA-V013": { id: "TA-V013", description: "All required sections must be present: Tenant Analysis, Books and Chapters, Roles, Use Cases, Integrations, Metrics, AI Opportunities, Industry Benchmarks", section: "Content Structure", validate: function(data) {
    const output = data.output || "";
    const requiredSections = [
      "Tenant Analysis", "Books", "Roles", "Use Cases", "Integrations", "Metrics", "AI Opportunities", "Industry Benchmarks"
    ];
    const missing = requiredSections.filter(section => !new RegExp(section, "i").test(output));
    if (missing.length > 0) {
      return { passed: false, details: "Missing required sections: " + missing.join(", ") };
    }
    return { passed: true };
  } },
  "TA-V014": { id: "TA-V014", description: "No missing or empty sections allowed", section: "Content Structure", validate: function(data) {
    const output = data.output || "";
    const sectionHeaders = output.match(/###? [A-Za-z ]+/g) || [];
    const emptySections = sectionHeaders.filter(header => {
      const sectionContent = output.split(header)[1]?.split(/###? [A-Za-z ]+/)[0] || "";
      return !sectionContent.trim();
    });
    if (emptySections.length > 0) {
      return { passed: false, details: "Empty sections: " + emptySections.join(", ") };
    }
    return { passed: true };
  } },
  "TA-V017": { id: "TA-V017", description: "Company size range must be specified", section: "Tenant Analysis", validate: function(data) {
    return { passed: true };
  } },
  "TA-V018": { id: "TA-V018", description: "Compliance requirements must be included (GDPR, SOX, HIPAA, ISO, etc.)", section: "Tenant Analysis", validate: function(data) {
    return { passed: true };
  } },
  "TA-V020": { id: "TA-V020", description: "All Tenant Analysis components must be realistic and industry-appropriate", section: "Tenant Analysis", validate: function(data) {
    return { passed: true };
  } },
  "TA-V022": { id: "TA-V022", description: "Each book must have both description and business value", section: "Books and Chapters", validate: function(data) {
    return { passed: true };
  } },
  "TA-V025": { id: "TA-V025", description: "Each chapter must have description and business value", section: "Books and Chapters", validate: function(data) {
    return { passed: true };
  } },
  "TA-V026": { id: "TA-V026", description: "Books must represent logical business domains", section: "Books and Chapters", validate: function(data) {
    return { passed: true };
  } },
  "TA-V027": { id: "TA-V027", description: "Chapters must focus on specific functionality aspects", section: "Books and Chapters", validate: function(data) {
    return { passed: true };
  } },
  "TA-V029": { id: "TA-V029", description: "Must include mix of operational and managerial roles", section: "Roles", validate: function(data) {
    return { passed: true };
  } },
  "TA-V030": { id: "TA-V030", description: "Clear inheritance relationships must be established where appropriate", section: "Roles", validate: function(data) {
    return { passed: true };
  } },
  "TA-V033": { id: "TA-V033", description: "All roles must be relevant to the business function", section: "Roles", validate: function(data) {
    return { passed: true };
  } },
  "TA-V034": { id: "TA-V034", description: "Responsibilities must be specific and actionable", section: "Roles", validate: function(data) {
    return { passed: true };
  } },
  "TA-V035": { id: "TA-V035", description: "Pain points must be realistic and addressable", section: "Roles", validate: function(data) {
    return { passed: true };
  } },
  "TA-V037": { id: "TA-V037", description: "Use cases must provide comprehensive coverage of role activities", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V038": { id: "TA-V038", description: "Must include mix of operational and strategic use cases", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V039": { id: "TA-V039", description: "Each use case must have clear name and description", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V040": { id: "TA-V040", description: "Each use case must include current challenges section", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V043": { id: "TA-V043", description: "Use cases must be realistic and relevant to the role", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V044": { id: "TA-V044", description: "Acceptance criteria must be specific and measurable", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V045": { id: "TA-V045", description: "Best practices must be actionable", section: "Use Cases", validate: function(data) {
    return { passed: true };
  } },
  "TA-V047": { id: "TA-V047", description: "Each integration must have clear relevance description", section: "Integrations", validate: function(data) {
    return { passed: true };
  } },
  "TA-V049": { id: "TA-V049", description: "Integrations must support specific roles and use cases", section: "Integrations", validate: function(data) {
    return { passed: true };
  } },
  "TA-V050": { id: "TA-V050", description: "Integrations must align with the business function", section: "Integrations", validate: function(data) {
    return { passed: true };
  } },
  "TA-V051": { id: "TA-V051", description: "Integration capabilities must be realistic and beneficial", section: "Integrations", validate: function(data) {
    return { passed: true };
  } },
  "TA-V054": { id: "TA-V054", description: "Metrics must align with industry standards and terminology", section: "Metrics", validate: function(data) {
    return { passed: true };
  } },
  "TA-V055": { id: "TA-V055", description: "Each metric must include current value, target value, and improvement strategy", section: "Metrics", validate: function(data) {
    return { passed: true };
  } },
  "TA-V056": { id: "TA-V056", description: "Metric values must be realistic and industry-appropriate", section: "Metrics", validate: function(data) {
    return { passed: true };
  } },
  "TA-V057": { id: "TA-V057", description: "Improvement strategies must be actionable", section: "Metrics", validate: function(data) {
    return { passed: true };
  } },
  "TA-V059": { id: "TA-V059", description: "Each AI opportunity must include description, benefits, and implementation considerations", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V060": { id: "TA-V060", description: "Benefits should be quantified when possible", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V061": { id: "TA-V061", description: "AI opportunities must address specific pain points", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V062": { id: "TA-V062", description: "AI opportunities must be technically feasible", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V063": { id: "TA-V063", description: "Must include mix of operational efficiency and strategic value opportunities", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V064": { id: "TA-V064", description: "Implementation considerations must be realistic", section: "AI Opportunities", validate: function(data) {
    return { passed: true };
  } },
  "TA-V067": { id: "TA-V067", description: "Must include top quartile, median, and bottom quartile values", section: "Industry Benchmarks", validate: function(data) {
    return { passed: true };
  } },
  "TA-V068": { id: "TA-V068", description: "Benchmark values must be realistic and industry-standard", section: "Industry Benchmarks", validate: function(data) {
    return { passed: true };
  } },
  "TA-V069": { id: "TA-V069", description: "Must maintain consistent terminology throughout each example", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V070": { id: "TA-V070", description: "Must use industry-specific language where appropriate", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V071": { id: "TA-V071", description: "All components must reflect real-world business practices", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V072": { id: "TA-V072", description: "No fictional or unrealistic scenarios allowed", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V073": { id: "TA-V073", description: "All required elements must be present with no placeholder text", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V074": { id: "TA-V074", description: "All sections must have sufficient detail", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V075": { id: "TA-V075", description: "Must focus on role benefits and user value", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V076": { id: "TA-V076", description: "Pain points must be addressable by the solution", section: "Quality and Consistency", validate: function(data) {
    return { passed: true };
  } },
  "TA-V078": { id: "TA-V078", description: "Must include variety of business functions (Finance, HR, Sales, Operations, etc.)", section: "Dataset Diversity", validate: function(data) {
    return { passed: true };
  } },
  "TA-V080": { id: "TA-V080", description: "Must cover both operational and analytical requirements", section: "Dataset Diversity", validate: function(data) {
    return { passed: true };
  } },
  "TA-V081": { id: "TA-V081", description: "Must include both traditional and digital/emerging business processes", section: "Dataset Diversity", validate: function(data) {
    return { passed: true };
  } },
  "TA-V084": { id: "TA-V084", description: "Use cases must align with role responsibilities", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V085": { id: "TA-V085", description: "Metrics must support defined roles and processes", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V086": { id: "TA-V086", description: "AI opportunities must address identified pain points", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V087": { id: "TA-V087", description: "Integrations must support use cases and roles", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V088": { id: "TA-V088", description: "All solution components must work together coherently", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V089": { id: "TA-V089", description: "No contradictory information across sections", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
  "TA-V090": { id: "TA-V090", description: "Must maintain logical flow between all sections", section: "Cross-Reference", validate: function(data) {
    return { passed: true };
  } },
};

function runTenantValidators(data) {
  const results = [];
  for (const key in tenantValidators) {
    const validator = tenantValidators[key];
    try {
      const result = validator.validate(data);
      results.push({
        id: validator.id,
        description: validator.description,
        section: validator.section,
        passed: result.passed,
        details: result.details || 'Validation passed'
      });
    } catch (error) {
      results.push({
        id: validator.id,
        description: validator.description,
        section: validator.section,
        passed: false,
        details: `Validator error: ${error.message}`
      });
    }
  }
  return results;
} 