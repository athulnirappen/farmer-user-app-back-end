import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/require-role.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import {
	changePasswordController,
	loginBuyerController,
	registerBuyerController,
	// OTP sign-in disabled for the MVP (no SMS provider). Uncomment to restore.
	// requestBuyerRegistrationOtpController,
	// startUserAuthController,
	// verifyBuyerLoginOtpController,
	// verifyBuyerRegistrationOtpController,
} from './user.controller.js';
import {
	changePasswordSchema,
	loginSchema,
	registerSchema,
	// OTP sign-in disabled for the MVP (no SMS provider). Uncomment to restore.
	// registerOtpSchema,
	// startUserAuthSchema,
	// verifyOtpSchema,
} from './user.schemas.js';

const userAuthRouter = Router();
const userAuthRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		status: 'error',
		statusCode: 429,
		message: 'Too many sign-in attempts; try again later.',
	},
});

userAuthRouter.post('/register', userAuthRateLimit, validate(registerSchema), registerBuyerController);
userAuthRouter.post('/login', userAuthRateLimit, validate(loginSchema), loginBuyerController);
userAuthRouter.post(
	'/change-password',
	userAuthRateLimit,
	authMiddleware,
	requireRole('USER'),
	validate(changePasswordSchema),
	changePasswordController
);

// OTP sign-in disabled for the MVP (no SMS provider). Uncomment to restore.
// userAuthRouter.post('/start', userAuthRateLimit, validate(startUserAuthSchema), startUserAuthController);
// userAuthRouter.post(
// 	'/register/request-otp',
// 	userAuthRateLimit,
// 	validate(registerOtpSchema),
// 	requestBuyerRegistrationOtpController
// );
// userAuthRouter.post(
// 	'/register/verify-otp',
// 	userAuthRateLimit,
// 	validate(verifyOtpSchema),
// 	verifyBuyerRegistrationOtpController
// );
// userAuthRouter.post(
// 	'/login/verify-otp',
// 	userAuthRateLimit,
// 	validate(verifyOtpSchema),
// 	verifyBuyerLoginOtpController
// );

export default userAuthRouter;
