/**
 * InputValidator - Centralized input validation and sanitization system
 * Prevents XSS, injection attacks, and ensures data integrity
 */

class InputValidator {
    constructor() {
        this.validators = {
            username: this.validateUsername.bind(this),
            email: this.validateEmail.bind(this),
            number: this.validateNumber.bind(this),
            text: this.validateText.bind(this),
            command: this.validateCommand.bind(this)
        };
        
        // Validation rules
        this.rules = {
            username: {
                minLength: 1,
                maxLength: 20,
                pattern: /^[a-zA-Z0-9\s_-]+$/,
                sanitize: true,
                trim: true
            },
            email: {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                maxLength: 255
            },
            number: {
                min: Number.MIN_SAFE_INTEGER,
                max: Number.MAX_SAFE_INTEGER
            },
            text: {
                maxLength: 500,
                sanitize: true,
                trim: true
            }
        };
        
        // Blocked patterns for security
        this.blockedPatterns = [
            /<script[^>]*>.*?<\/script>/gi,  // Script tags
            /<iframe[^>]*>.*?<\/iframe>/gi,   // Iframe tags
            /javascript:/gi,                   // Javascript protocol
            /on\w+\s*=/gi,                     // Event handlers
            /<\s*\/?\s*[a-z][\s\S]*>/gi,      // HTML tags
            /[<>'"]/g                          // Special characters
        ];
    }
    
    /**
     * Validate any input based on type
     */
    validate(value, type = 'text', options = {}) {
        const validator = this.validators[type];
        if (!validator) {
            console.warn(`[InputValidator] Unknown validation type: ${type}`);
            return this.validateText(value, options);
        }
        
        return validator(value, options);
    }
    
    /**
     * Validate username input
     */
    validateUsername(value, options = {}) {
        const rules = { ...this.rules.username, ...options };
        const result = {
            isValid: true,
            errors: [],
            sanitized: value
        };
        
        // Trim whitespace
        if (rules.trim) {
            result.sanitized = value.trim();
        }
        
        // Check length
        if (result.sanitized.length < rules.minLength) {
            result.isValid = false;
            result.errors.push(`Name must be at least ${rules.minLength} character${rules.minLength > 1 ? 's' : ''}`);
        }
        
        if (result.sanitized.length > rules.maxLength) {
            result.isValid = false;
            result.errors.push(`Name must be no more than ${rules.maxLength} characters`);
        }
        
        // Check pattern
        if (rules.pattern && !rules.pattern.test(result.sanitized)) {
            result.isValid = false;
            result.errors.push('Name can only contain letters, numbers, spaces, hyphens, and underscores');
        }
        
        // Sanitize if needed
        if (rules.sanitize) {
            result.sanitized = this.sanitize(result.sanitized);
        }
        
        return result;
    }
    
    /**
     * Validate email input
     */
    validateEmail(value, options = {}) {
        const rules = { ...this.rules.email, ...options };
        const result = {
            isValid: true,
            errors: [],
            sanitized: value.trim().toLowerCase()
        };
        
        // Check pattern
        if (!rules.pattern.test(result.sanitized)) {
            result.isValid = false;
            result.errors.push('Please enter a valid email address');
        }
        
        // Check length
        if (result.sanitized.length > rules.maxLength) {
            result.isValid = false;
            result.errors.push('Email address is too long');
        }
        
        return result;
    }
    
    /**
     * Validate number input
     */
    validateNumber(value, options = {}) {
        const rules = { ...this.rules.number, ...options };
        const result = {
            isValid: true,
            errors: [],
            sanitized: value
        };
        
        // Parse number
        const num = Number(value);
        
        // Check if valid number
        if (isNaN(num)) {
            result.isValid = false;
            result.errors.push('Please enter a valid number');
            return result;
        }
        
        // Check range
        if (rules.min !== undefined && num < rules.min) {
            result.isValid = false;
            result.errors.push(`Number must be at least ${rules.min}`);
        }
        
        if (rules.max !== undefined && num > rules.max) {
            result.isValid = false;
            result.errors.push(`Number must be no more than ${rules.max}`);
        }
        
        // Check decimal places
        if (rules.decimals !== undefined) {
            const decimalCount = (num.toString().split('.')[1] || '').length;
            if (decimalCount > rules.decimals) {
                result.isValid = false;
                result.errors.push(`Number can have at most ${rules.decimals} decimal places`);
            }
        }
        
        result.sanitized = num;
        return result;
    }
    
    /**
     * Validate general text input
     */
    validateText(value, options = {}) {
        const rules = { ...this.rules.text, ...options };
        const result = {
            isValid: true,
            errors: [],
            sanitized: value
        };
        
        // Trim if needed
        if (rules.trim) {
            result.sanitized = value.trim();
        }
        
        // Check length
        if (rules.minLength !== undefined && result.sanitized.length < rules.minLength) {
            result.isValid = false;
            result.errors.push(`Text must be at least ${rules.minLength} characters`);
        }
        
        if (rules.maxLength !== undefined && result.sanitized.length > rules.maxLength) {
            result.isValid = false;
            result.errors.push(`Text must be no more than ${rules.maxLength} characters`);
        }
        
        // Check for blocked patterns
        if (rules.checkBlocked !== false) {
            for (const pattern of this.blockedPatterns) {
                if (pattern.test(result.sanitized)) {
                    result.isValid = false;
                    result.errors.push('Text contains invalid characters or patterns');
                    break;
                }
            }
        }
        
        // Sanitize if needed
        if (rules.sanitize) {
            result.sanitized = this.sanitize(result.sanitized);
        }
        
        return result;
    }
    
    /**
     * Validate command/action input (for keyboard shortcuts)
     */
    validateCommand(value, options = {}) {
        const allowedCommands = options.allowed || [];
        const result = {
            isValid: true,
            errors: [],
            sanitized: value.toLowerCase().trim()
        };
        
        if (allowedCommands.length > 0 && !allowedCommands.includes(result.sanitized)) {
            result.isValid = false;
            result.errors.push('Invalid command');
        }
        
        return result;
    }
    
    /**
     * Sanitize input to prevent XSS
     */
    sanitize(value) {
        if (typeof value !== 'string') {
            return value;
        }
        
        // HTML entity encode dangerous characters
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/`/g, '&#x60;')
            .replace(/=/g, '&#x3D;');
    }
    
    /**
     * Decode sanitized text for display
     */
    decode(value) {
        if (typeof value !== 'string') {
            return value;
        }
        
        const textarea = document.createElement('textarea');
        textarea.innerHTML = value;
        return textarea.value;
    }
    
    /**
     * Validate form data object
     */
    validateForm(formData, schema) {
        const results = {};
        const errors = {};
        const sanitized = {};
        let isValid = true;
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = formData[field];
            const validationType = rules.type || 'text';
            const options = rules.options || {};
            
            // Check required fields
            if (rules.required && (!value || value.toString().trim() === '')) {
                errors[field] = [`${rules.label || field} is required`];
                isValid = false;
                continue;
            }
            
            // Skip optional empty fields
            if (!rules.required && (!value || value.toString().trim() === '')) {
                continue;
            }
            
            // Validate field
            const result = this.validate(value, validationType, options);
            
            if (!result.isValid) {
                errors[field] = result.errors;
                isValid = false;
            }
            
            sanitized[field] = result.sanitized;
            results[field] = result;
        }
        
        return {
            isValid,
            errors,
            sanitized,
            results
        };
    }
    
    /**
     * Create real-time validation for input element
     */
    attachValidator(element, type = 'text', options = {}) {
        if (!element) return;
        
        let debounceTimer;
        const debounceDelay = options.debounce || 300;
        
        const validateInput = () => {
            const value = element.value;
            const result = this.validate(value, type, options);
            
            // Update element styling
            if (result.isValid) {
                element.classList.remove('input-error');
                element.classList.add('input-valid');
            } else {
                element.classList.remove('input-valid');
                element.classList.add('input-error');
            }
            
            // Show/hide error messages
            const errorElement = element.parentElement.querySelector('.input-error-message');
            if (errorElement) {
                if (result.isValid) {
                    errorElement.style.display = 'none';
                    errorElement.textContent = '';
                } else {
                    errorElement.style.display = 'block';
                    errorElement.textContent = result.errors.join('. ');
                }
            }
            
            // Trigger custom event
            element.dispatchEvent(new CustomEvent('validation', {
                detail: result
            }));
            
            return result;
        };
        
        // Add event listeners
        element.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(validateInput, debounceDelay);
        });
        
        element.addEventListener('blur', () => {
            clearTimeout(debounceTimer);
            validateInput();
        });
        
        // Add CSS classes if not present
        this.addValidationStyles();
        
        return validateInput;
    }
    
    /**
     * Add validation CSS styles
     */
    addValidationStyles() {
        if (document.getElementById('input-validator-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'input-validator-styles';
        style.textContent = `
            .input-error {
                border-color: #dc3545 !important;
                box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
            }
            
            .input-valid {
                border-color: #28a745 !important;
                box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25) !important;
            }
            
            .input-error-message {
                color: #dc3545;
                font-size: 0.875rem;
                margin-top: 0.25rem;
                display: none;
            }
            
            .input-success-message {
                color: #28a745;
                font-size: 0.875rem;
                margin-top: 0.25rem;
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Check for common security issues in text
     */
    checkSecurity(text) {
        const issues = [];
        
        // Check for script injection
        if (/<script/i.test(text)) {
            issues.push('Script tags detected');
        }
        
        // Check for SQL injection patterns
        if (/(\bor\b|\band\b)\s*1\s*=\s*1|;\s*(drop|delete|truncate)\s+/i.test(text)) {
            issues.push('SQL injection pattern detected');
        }
        
        // Check for command injection
        if (/[;&|`$]/.test(text)) {
            issues.push('Command injection characters detected');
        }
        
        // Check for path traversal
        if (/\.\.\/|\.\.\\/.test(text)) {
            issues.push('Path traversal pattern detected');
        }
        
        return {
            isSecure: issues.length === 0,
            issues
        };
    }
}

// Create global instance
window.InputValidator = new InputValidator();