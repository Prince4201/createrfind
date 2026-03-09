import { body, query, validationResult } from 'express-validator';

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
}

const validateDiscoverFilters = [
    body('keyword')
        .trim()
        .notEmpty()
        .withMessage('Keyword is required')
        .isLength({ max: 200 })
        .withMessage('Keyword must be under 200 characters'),
    body('minSubscribers')
        .isInt({ min: 0 })
        .withMessage('minSubscribers must be a non-negative integer'),
    body('maxSubscribers')
        .isInt({ min: 1 })
        .withMessage('maxSubscribers must be a positive integer')
        .custom((value, { req }) => {
            if (parseInt(value) <= parseInt(req.body.minSubscribers)) {
                throw new Error('maxSubscribers must be greater than minSubscribers');
            }
            return true;
        }),
    body('minAvgViews')
        .isInt({ min: 0 })
        .withMessage('minAvgViews must be a non-negative integer'),
    body('maxChannels')
        .isInt({ min: 1, max: 50 })
        .withMessage('maxChannels must be between 1 and 50'),
    handleValidation,
];

const validateCampaign = [
    body('campaignName')
        .trim()
        .notEmpty()
        .withMessage('Campaign name is required')
        .isLength({ max: 200 }),
    body('subject')
        .trim()
        .notEmpty()
        .withMessage('Email subject is required')
        .isLength({ max: 500 }),
    body('bodyTemplate')
        .trim()
        .notEmpty()
        .withMessage('Email body template is required')
        .isLength({ max: 10000 }),
    handleValidation,
];

const validateSendEmails = [
    body('campaignId')
        .trim()
        .notEmpty()
        .withMessage('Campaign ID is required'),
    body('channelIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('channelIds must be an array with 1–50 items'),
    body('channelIds.*')
        .isString()
        .withMessage('Each channelId must be a string'),
    handleValidation,
];

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    handleValidation,
];

export {
    validateDiscoverFilters,
    validateCampaign,
    validateSendEmails,
    validatePagination,
};
