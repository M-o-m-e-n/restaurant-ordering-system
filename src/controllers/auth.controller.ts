import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middlewares/error.middleware';

export class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, phone } = req.body;

    const result = await authService.register({
      email,
      password,
      name,
      phone,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      await authService.logout(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const tokens = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: tokens,
    });
  });

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await authService.forgotPassword(email);

    res.json({
      success: true,
      ...result,
    });
  });

  /**
   * Reset password with OTP
   * POST /api/auth/reset-password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, password } = req.body;

    await authService.resetPassword(email, otp, password);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  });

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const user = await authService.getProfile(userId);

    res.json({
      success: true,
      data: user,
    });
  });

  /**
   * Update current user profile
   * PATCH /api/auth/profile
   */
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { name, phone, fcmToken } = req.body;

    const user = await authService.updateProfile(userId, { name, phone, fcmToken });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  });

  /**
   * Change password
   * POST /api/auth/change-password
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });
}

export const authController = new AuthController();
export default authController;

