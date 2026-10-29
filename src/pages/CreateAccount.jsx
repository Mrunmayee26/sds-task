import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  UserRoundPlus,
  ShieldCheck,
  ArrowLeft,
  RotateCw,
  Building2,
  Briefcase,
} from "lucide-react";
import {
  AuthBrandPanel,
  RoleSelector,
  PendingApprovalScreen,
} from "../components";
import {
  dashboardForRole,
  requestRegistrationOtp,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  fetchDepartments,
} from "../services/auth.js";
import { useAuth } from "../hooks/useAuth";
import authStyles from "./Login.module.css";
import styles from "./CreateAccount.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FALLBACK_DEPARTMENTS = [
  { unit_id: 1, unit_name: "Registrar's Office" },
  {
    unit_id: 2,
    unit_name: "Bhau Institute of Innovation, Entrepreneurship and Leadership",
  },
  { unit_id: 3, unit_name: "Department of Computer Engineering" },
  { unit_id: 4, unit_name: "Department of Mechanical Engineering" },
  { unit_id: 5, unit_name: "Department of Civil Engineering" },
  { unit_id: 6, unit_name: "Department of Electrical Engineering" },
  { unit_id: 7, unit_name: "Department of Electronics and Telecommunication" },
  { unit_id: 8, unit_name: "Department of Instrumentation and Control" },
  {
    unit_id: 9,
    unit_name: "Department of Metallurgy and Material Engineering",
  },
  { unit_id: 10, unit_name: "Department of Manufacturing Engineering" },
  { unit_id: 11, unit_name: "Gymkhana and Sports Office" },
];

const validateForm = (form, role) => {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!form.lastName.trim()) errors.lastName = "Enter your last name.";
  if (!form.email.trim()) errors.email = "Enter your college email.";
  else if (!EMAIL_PATTERN.test(form.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!form.password) errors.password = "Enter a password.";
  else if (form.password.length < 6)
    errors.password = "Use at least 6 characters.";
  if (!form.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (form.confirmPassword !== form.password)
    errors.confirmPassword = "Passwords do not match.";

  if (role === "approver") {
    if (!form.home_unit_id)
      errors.home_unit_id = "Please select your department.";
    if (!form.designation?.trim())
      errors.designation = "Please enter your role or title.";
  }

  return errors;
};

export default function CreateAccount() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [role, setRole] = useState("applicant");
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    home_unit_id: "",
    designation: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States: 'form' | 'otp' | 'pending_approval'
  const [step, setStep] = useState("form");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Fetch departments on mount for approver selector
  useEffect(() => {
    let mounted = true;
    fetchDepartments()
      .then((list) => {
        if (mounted && list && list.length > 0) {
          setDepartments(list);
        }
      })
      .catch((error) => {
        if (mounted) setFeedback(error.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (session) return <Navigate to={dashboardForRole(session.role)} replace />;

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFeedback("");
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSuccessMsg("");
    const nextErrors = validateForm(form, role);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await requestRegistrationOtp({ ...form, role });
      if (!result.ok) {
        setFeedback(result.message || "Registration could not be initiated.");
      } else {
        setStep("otp");
        setResendCooldown(60);
        setSuccessMsg(
          result.message || `Verification code sent to ${form.email}`,
        );
      }
    } catch {
      setFeedback(
        "Registration service could not be reached. Please try again later.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSuccessMsg("");
    if (!otp.trim() || otp.trim().length !== 6) {
      setFeedback("Please enter the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyRegistrationOtp(form.email, otp.trim());
      if (!result.ok) {
        setFeedback(result.message || "Invalid or expired verification code.");
      } else if (result.pendingApproval) {
        // Approver account created, waiting for admin activation
        setStep("pending_approval");
      } else {
        // Applicant account auto-activated
        navigate(dashboardForRole(result.user?.role || "applicant"), {
          replace: true,
        });
      }
    } catch {
      setFeedback("Verification could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setFeedback("");
    setSuccessMsg("");
    setIsSubmitting(true);
    try {
      const result = await resendRegistrationOtp(form.email);
      if (!result.ok) {
        setFeedback(result.message || "Failed to resend code.");
      } else {
        setResendCooldown(60);
        setSuccessMsg(
          result.message || "A fresh verification code has been dispatched.",
        );
      }
    } catch {
      setFeedback("Failed to resend verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (name) =>
    errors[name] ? (
      <span
        className={styles.fieldError}
        id={`register-${name}-error`}
        role="alert"
      >
        {errors[name]}
      </span>
    ) : null;

  return (
    <main className={styles.page}>
      <AuthBrandPanel />
      <section
        className={`${authStyles.formPanel} ${styles.formPanel}`}
        aria-labelledby="create-account-title"
      >
        <div className={`${authStyles.formContent} ${styles.formContent}`}>
          {step === "form" && (
            <>
              <p className={authStyles.welcomeLabel}>CREATE YOUR ACCOUNT</p>
              <h2 id="create-account-title">Join your campus workspace</h2>
              <p className={authStyles.formSubtitle}>
                Register with your official college credentials.
              </p>

              <form
                className={`${authStyles.form} ${styles.registerForm}`}
                onSubmit={handleRequestOtp}
                noValidate
              >
                {/* Role Switcher */}
                <RoleSelector
                  role={role}
                  onChangeRole={(newRole) => {
                    setRole(newRole);
                    setErrors({});
                    setFeedback("");
                  }}
                />

                <div className={styles.nameFields}>
                  <div className={authStyles.field}>
                    <label htmlFor="register-first-name">First name</label>
                    <div className={authStyles.inputWrap}>
                      <UserRound size={17} aria-hidden="true" />
                      <input
                        id="register-first-name"
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="First name"
                        value={form.firstName}
                        onChange={(event) =>
                          updateField("firstName", event.target.value)
                        }
                        aria-invalid={Boolean(errors.firstName)}
                        aria-describedby={
                          errors.firstName
                            ? "register-firstName-error"
                            : undefined
                        }
                      />
                    </div>
                    {fieldError("firstName")}
                  </div>

                  <div className={authStyles.field}>
                    <label htmlFor="register-last-name">Last name</label>
                    <div className={authStyles.inputWrap}>
                      <UserRound size={17} aria-hidden="true" />
                      <input
                        id="register-last-name"
                        name="lastName"
                        autoComplete="family-name"
                        placeholder="Last name"
                        value={form.lastName}
                        onChange={(event) =>
                          updateField("lastName", event.target.value)
                        }
                        aria-invalid={Boolean(errors.lastName)}
                        aria-describedby={
                          errors.lastName
                            ? "register-lastName-error"
                            : undefined
                        }
                      />
                    </div>
                    {fieldError("lastName")}
                  </div>
                </div>

                <div className={authStyles.field}>
                  <label htmlFor="register-email">College email</label>
                  <div className={authStyles.inputWrap}>
                    <Mail size={17} aria-hidden="true" />
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? "register-email-error" : undefined
                      }
                    />
                  </div>
                  {fieldError("email")}
                </div>

                {role === "approver" && (
                  <>
                    <div className={authStyles.field}>
                      <label htmlFor="register-department">
                        Department / Academic Unit
                      </label>
                      <div className={authStyles.inputWrap}>
                        <Building2 size={17} aria-hidden="true" />
                        <select
                          id="register-department"
                          name="home_unit_id"
                          value={form.home_unit_id}
                          onChange={(e) =>
                            updateField("home_unit_id", e.target.value)
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: "13px",
                            color: form.home_unit_id
                              ? "var(--color-text-primary)"
                              : "#aaa7b7",
                          }}
                        >
                          <option value="">Select your department...</option>
                          {departments.map((dept) => (
                            <option key={dept.unit_id} value={dept.unit_id}>
                              {dept.unit_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {fieldError("home_unit_id")}
                    </div>

                    <div className={authStyles.field}>
                      <label htmlFor="register-designation">
                        Designation / Role Title
                      </label>
                      <div className={authStyles.inputWrap}>
                        <Briefcase size={17} aria-hidden="true" />
                        <input
                          id="register-designation"
                          name="designation"
                          placeholder="e.g. Professor &amp; HOD, Dean, Faculty In-charge"
                          value={form.designation}
                          onChange={(e) =>
                            updateField("designation", e.target.value)
                          }
                          aria-invalid={Boolean(errors.designation)}
                        />
                      </div>
                      {fieldError("designation")}
                    </div>
                  </>
                )}

                <div className={styles.passwordFields}>
                  <div className={authStyles.field}>
                    <label htmlFor="register-password">Password</label>
                    <div className={authStyles.inputWrap}>
                      <LockKeyhole size={17} aria-hidden="true" />
                      <input
                        id="register-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                        value={form.password}
                        onChange={(event) =>
                          updateField("password", event.target.value)
                        }
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={
                          errors.password
                            ? "register-password-error"
                            : undefined
                        }
                      />
                      <button
                        className={authStyles.showPassword}
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {fieldError("password")}
                  </div>

                  <div className={authStyles.field}>
                    <label htmlFor="register-confirm-password">
                      Confirm password
                    </label>
                    <div className={authStyles.inputWrap}>
                      <LockKeyhole size={17} aria-hidden="true" />
                      <input
                        id="register-confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={(event) =>
                          updateField("confirmPassword", event.target.value)
                        }
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={
                          errors.confirmPassword
                            ? "register-confirmPassword-error"
                            : undefined
                        }
                      />
                      <button
                        className={authStyles.showPassword}
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((visible) => !visible)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {fieldError("confirmPassword")}
                  </div>
                </div>

                {feedback && (
                  <p className={authStyles.error} role="alert">
                    {feedback}
                  </p>
                )}

                <button
                  className={authStyles.submit}
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Sending verification code…"
                    : "Continue to verification"}
                  {!isSubmitting && (
                    <UserRoundPlus size={17} aria-hidden="true" />
                  )}
                </button>
              </form>

              <p className={styles.signInLink}>
                Already have an account?{" "}
                <Link to="/" className={authStyles.textLink}>
                  Sign in
                </Link>
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <button
                type="button"
                className={authStyles.textLink}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#6847d3",
                }}
                onClick={() => {
                  setStep("form");
                  setFeedback("");
                  setSuccessMsg("");
                }}
              >
                <ArrowLeft size={16} /> Edit registration details
              </button>

              <p className={authStyles.welcomeLabel}>EMAIL VERIFICATION</p>
              <h2 id="create-account-title">Enter 6-digit code</h2>
              <p className={authStyles.formSubtitle}>
                We sent a verification code to <strong>{form.email}</strong>.
              </p>

              {successMsg && (
                <p
                  style={{
                    color: "#16a34a",
                    fontSize: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {successMsg}
                </p>
              )}

              <form
                className={`${authStyles.form} ${styles.registerForm}`}
                onSubmit={handleVerifyOtp}
                noValidate
              >
                <div className={authStyles.field}>
                  <label htmlFor="verify-otp-input">Verification Code</label>
                  <div className={authStyles.inputWrap}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    <input
                      id="verify-otp-input"
                      name="otp"
                      type="text"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setOtp(val);
                        setFeedback("");
                      }}
                      style={{
                        letterSpacing: "4px",
                        fontSize: "18px",
                        fontWeight: "bold",
                      }}
                    />
                  </div>
                </div>

                {feedback && (
                  <p className={authStyles.error} role="alert">
                    {feedback}
                  </p>
                )}

                <button
                  className={authStyles.submit}
                  type="submit"
                  disabled={isSubmitting || otp.length !== 6}
                >
                  {isSubmitting
                    ? "Verifying…"
                    : "Verify & Complete Registration"}
                  {!isSubmitting && (
                    <ShieldCheck size={17} aria-hidden="true" />
                  )}
                </button>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "14px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isSubmitting}
                    style={{
                      background: "none",
                      border: "none",
                      color: resendCooldown > 0 ? "#94a3b8" : "#6847d3",
                      cursor: resendCooldown > 0 ? "default" : "pointer",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RotateCw size={14} />
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "pending_approval" && (
            <PendingApprovalScreen
              email={form.email}
              departmentName={
                departments.find(
                  (d) => String(d.unit_id) === String(form.home_unit_id),
                )?.unit_name || "your department"
              }
              onReturnToSignIn={() => navigate("/")}
            />
          )}
        </div>
      </section>
    </main>
  );
}
