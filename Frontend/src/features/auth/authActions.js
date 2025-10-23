import API from "../../api/auth";
import APIADMIN from "../../api/admin";
import {
  SET_FIELD,
  RESET_FORM,
  SIGNUP_REQUEST,
  SIGNUP_SUCCESS,
  SIGNUP_FAILURE,
  LOGIN_REQUEST,
  LOGIN_SUCCESS,
  LOGIN_FAILURE,
  LOGOUT,
  VERIFY_OTP_REQUEST,
  VERIFY_OTP_SUCCESS,
  VERIFY_OTP_FAILURE,
  FORGOT_PASSWORD_REQUEST,
  FORGOT_PASSWORD_SUCCESS,
  FORGOT_PASSWORD_FAILURE,
  RESET_PASSWORD_REQUEST,
  RESET_PASSWORD_SUCCESS,
  RESET_PASSWORD_FAILURE,
  VERIFY_RESET_OTP_REQUEST,
  VERIFY_RESET_OTP_SUCCESS,
  VERIFY_RESET_OTP_FAILURE,
} from "./authReducer";

// ----- Field Actions -----
export const setField = (field, value) => ({
  type: SET_FIELD,
  payload: { field, value },
});
export const resetForm = () => ({ type: RESET_FORM });

// ----- Signup -----
export const signupUser = (data) => async (dispatch) => {
  dispatch({ type: SIGNUP_REQUEST });
  try {
    const res = await API.post("/signup", data);
    dispatch({ type: SIGNUP_SUCCESS });
    dispatch(resetForm());
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Signup failed";
    dispatch({ type: SIGNUP_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

export const verifyOtp = (data) => async (dispatch) => {
  dispatch({ type: VERIFY_OTP_REQUEST });
  try {
    const res = await API.post("/verify-otp", data);
    dispatch({ type: VERIFY_OTP_SUCCESS });
    dispatch(resetForm());
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "OTP verification failed";
    dispatch({ type: VERIFY_OTP_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Login -----
export const loginUser = (data) => async (dispatch) => {
  dispatch({ type: LOGIN_REQUEST });
  try {
    const res = await API.post("/login", data, { withCredentials: true });
    dispatch({ type: LOGIN_SUCCESS, payload: res.data.user });
    dispatch(resetForm());
    return res.data.user;
  } catch (err) {
    const message = err.response?.data?.message || "Login failed";
    dispatch({ type: LOGIN_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Logout -----
export const logout = () => async (dispatch) => {
  try {
    await API.post("/logout", {}, { withCredentials: true });
    dispatch({ type: LOGOUT });
  } catch (err) {
    console.error("Logout failed:", err);
    dispatch({ type: LOGOUT });
  }
};

// ----- Forgot Password -----
export const sendResetOtp = (email) => async (dispatch) => {
  dispatch({ type: FORGOT_PASSWORD_REQUEST });
  try {
    const res = await API.post("/forgot-password", { email });
    dispatch({ type: FORGOT_PASSWORD_SUCCESS, payload: res.data.message });
    dispatch(resetForm());
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Failed to send OTP";
    dispatch({ type: FORGOT_PASSWORD_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Verify Reset OTP -----
export const verifyResetOtpAction = (email, otp) => async (dispatch) => {
  dispatch({ type: VERIFY_RESET_OTP_REQUEST });
  try {
    const res = await API.post("/verify-reset-otp", { email, otp });
    dispatch({ type: VERIFY_RESET_OTP_SUCCESS, payload: res.data.message });
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "OTP verification failed";
    dispatch({ type: VERIFY_RESET_OTP_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Reset Password -----
export const resetPasswordAction = (email, newPassword) => async (dispatch) => {
  dispatch({ type: RESET_PASSWORD_REQUEST });
  try {
    const res = await API.post("/reset-password", { email, newPassword });
    dispatch({ type: RESET_PASSWORD_SUCCESS, payload: res.data.message });
    dispatch(resetForm());
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Password reset failed";
    dispatch({ type: RESET_PASSWORD_FAILURE, payload: message });
    return Promise.reject(message);
  }
};
