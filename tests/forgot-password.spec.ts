import { test, expect } from "@playwright/test";

test.describe("Forgot Password & OTP Workflow Verification", () => {
  test.setTimeout(180000);

  test("Complete forgot password flow: request OTP, 10-minute validity notice, 1-minute resend timer, OTP verification, password reset, and login with new password", async ({
    page,
    request,
  }) => {
    const suffix = Date.now().toString(36);
    const email = `merchant-${suffix}@example.test`;
    const initialPassword = `Initial-Password-${suffix}!`;
    const newPassword = `BrandNew-Pass-${suffix}-Secure!`;

    // 1. Register a test merchant account
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("Test Merchant");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(initialPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(initialPassword);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60000 });

    // 2. Navigate to /login to test Forgot Password
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible({
      timeout: 15000,
    });

    // 3. Verify "Forgot password?" entry point is visible on login form
    const forgotLink = page.getByRole("button", { name: "Forgot password?" });
    await expect(forgotLink).toBeVisible();

    // 4. Click "Forgot password?" to open Step 1 (Ask email)
    await forgotLink.click();
    await expect(
      page.getByRole("heading", { name: "Forgot password?" }),
    ).toBeVisible();
    await expect(page.locator(".auth-step-kicker")).toHaveText("Account recovery");
    await expect(page.getByText("Codes are valid for 10 minutes.")).toBeVisible();

    // Test validation on invalid email
    const emailInput = page.getByLabel("Email address", { exact: true });
    await emailInput.fill("invalid-email");
    await page.getByRole("button", { name: "Send verification code" }).click();
    await expect(page.locator(".auth-field-error")).toHaveText(
      "Enter a valid email address.",
    );

    // Test unregistered email
    await emailInput.fill(`unregistered-${suffix}@example.test`);
    await page.getByRole("button", { name: "Send verification code" }).click();
    await expect(page.locator(".auth-result")).toContainText(
      "No account found with this email address.",
    );

    // Enter registered email and submit
    await emailInput.fill(email);
    await page.getByRole("button", { name: "Send verification code" }).click();

    // 5. Verify Step 2: "Check your email" (Enter & Verify OTP)
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".auth-step-kicker")).toHaveText("Step 2 of 3");
    await expect(page.getByText("The code is valid for 10 minutes.")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Verify 1-minute countdown timer is active on resend button
    const resendBtn = page.locator(".auth-resend-button");
    await expect(resendBtn).toBeVisible();
    await expect(resendBtn).toBeDisabled();
    const resendText = await resendBtn.textContent();
    expect(resendText).toMatch(/Resend code in \d+s/);

    // 6. Test OTP verification errors
    const otpInput = page.locator(".auth-otp-input");
    await expect(otpInput).toBeVisible();

    // Enter wrong 6-digit code
    await otpInput.fill("000000");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.locator(".auth-result")).toContainText(
      "Incorrect verification code. Please check and try again.",
    );

    // 7. Obtain the valid OTP from page state
    const validOtp = await page.evaluate(
      () => (window as unknown as { __DEV_OTP__?: string }).__DEV_OTP__,
    );
    expect(validOtp, "Valid 6-digit OTP should be generated").toBeDefined();
    expect(validOtp).toMatch(/^\d{6}$/);

    // Verify backend 1-minute cooldown enforcement
    const rateLimitRes = await request.post(
      "http://127.0.0.1:4000/api/v1/auth/forgot-password",
      {
        headers: { Origin: "http://localhost:3000" },
        data: { email },
      },
    );
    expect(rateLimitRes.status()).toBe(429);
    const rateLimitData = await rateLimitRes.json();
    expect(rateLimitData.code).toBe("RATE_LIMITED");
    expect(rateLimitData.message).toMatch(/Please wait \d+ seconds before requesting a new code\./);

    // 8. Submit the valid OTP
    await otpInput.fill(validOtp!);
    await page.getByRole("button", { name: "Verify code" }).click();

    // 9. Verify Step 3: "Create new password"
    await expect(
      page.getByRole("heading", { name: "Create new password" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".auth-step-kicker")).toHaveText("Step 3 of 3");

    // Test password validation (< 12 characters)
    const newPassInput = page.getByLabel("New password", { exact: true });
    const confirmInput = page.getByLabel("Confirm new password", { exact: true });
    await newPassInput.fill("short");
    await confirmInput.fill("short");
    await page.getByRole("button", { name: /Update password/ }).click();
    await expect(page.locator("#password-error")).toContainText(
      "Use 12–128 characters for your password.",
    );

    // Test password mismatch
    await newPassInput.fill(newPassword);
    await confirmInput.fill("Mismatch-Password-123456!");
    await page.getByRole("button", { name: /Update password/ }).click();
    await expect(page.locator("#confirm-error")).toContainText(
      "Passwords do not match.",
    );

    // Enter matching new password
    await confirmInput.fill(newPassword);
    await page.getByRole("button", { name: /Update password/ }).click();

    // Verify success confirmation and automatic redirection to workspace
    await expect(page.locator(".auth-result")).toContainText(
      "Your password has been reset successfully.",
    );
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // 10. Verify logging in with the new password
    await page.goto("/login");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    // Old password should fail
    await page.getByLabel("Password", { exact: true }).fill(initialPassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.locator(".auth-result")).toContainText(
      "Email or password is incorrect.",
    );

    // New password should succeed
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });
});
