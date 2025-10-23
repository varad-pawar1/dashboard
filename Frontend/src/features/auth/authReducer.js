// ----- Action Types -----
export const SET_FIELD = "auth/SET_FIELD";
export const RESET_FORM = "auth/RESET_FORM";

export const SIGNUP_REQUEST = "auth/SIGNUP_REQUEST";
export const SIGNUP_SUCCESS = "auth/SIGNUP_SUCCESS";
export const SIGNUP_FAILURE = "auth/SIGNUP_FAILURE";

export const LOGIN_REQUEST = "auth/LOGIN_REQUEST";
export const LOGIN_SUCCESS = "auth/LOGIN_SUCCESS";
export const LOGIN_FAILURE = "auth/LOGIN_FAILURE";

export const LOGOUT = "auth/LOGOUT";

export const VERIFY_OTP_REQUEST = "auth/VERIFY_OTP_REQUEST";
export const VERIFY_OTP_SUCCESS = "auth/VERIFY_OTP_SUCCESS";
export const VERIFY_OTP_FAILURE = "auth/VERIFY_OTP_FAILURE";

// ----- Forgot / Reset Password -----
export const FORGOT_PASSWORD_REQUEST = "auth/FORGOT_PASSWORD_REQUEST";
export const FORGOT_PASSWORD_SUCCESS = "auth/FORGOT_PASSWORD_SUCCESS";
export const FORGOT_PASSWORD_FAILURE = "auth/FORGOT_PASSWORD_FAILURE";

export const RESET_PASSWORD_REQUEST = "auth/RESET_PASSWORD_REQUEST";
export const RESET_PASSWORD_SUCCESS = "auth/RESET_PASSWORD_SUCCESS";
export const RESET_PASSWORD_FAILURE = "auth/RESET_PASSWORD_FAILURE";

export const VERIFY_RESET_OTP_REQUEST = "auth/VERIFY_RESET_OTP_REQUEST";
export const VERIFY_RESET_OTP_SUCCESS = "auth/VERIFY_RESET_OTP_SUCCESS";
export const VERIFY_RESET_OTP_FAILURE = "auth/VERIFY_RESET_OTP_FAILURE";

// ----- Initial State -----
const initialState = {
  user: null,
  loading: false,
  error: null,
  successMessage: null,
  form: {
    name: "",
    email: "",
    password: "",
    otp: "",
  },
};

// ----- Reducer -----
export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case SET_FIELD:
      return {
        ...state,
        form: { ...state.form, [action.payload.field]: action.payload.value },
      };
    case RESET_FORM:
      return { ...state, form: initialState.form };

    // Loading
    case SIGNUP_REQUEST:
    case LOGIN_REQUEST:
    case VERIFY_OTP_REQUEST:
    case FORGOT_PASSWORD_REQUEST:
    case RESET_PASSWORD_REQUEST:
    case VERIFY_RESET_OTP_REQUEST:
      return { ...state, loading: true, error: null, successMessage: null };

    // Success
    case SIGNUP_SUCCESS:
    case VERIFY_OTP_SUCCESS:
      return { ...state, loading: false };
    case LOGIN_SUCCESS:
      return { ...state, loading: false, user: action.payload };
    case FORGOT_PASSWORD_SUCCESS:
    case RESET_PASSWORD_SUCCESS:
    case VERIFY_RESET_OTP_SUCCESS:
      return { ...state, loading: false, successMessage: action.payload };

    // Failure
    case SIGNUP_FAILURE:
    case LOGIN_FAILURE:
    case VERIFY_OTP_FAILURE:
    case FORGOT_PASSWORD_FAILURE:
    case RESET_PASSWORD_FAILURE:
    case VERIFY_RESET_OTP_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case LOGOUT:
      return { ...state, user: null, error: null, form: initialState.form };

    default:
      return state;
  }
}
