// ----- Action Types -----
export const SET_FIELD = "admin/SET_FIELD";
export const RESET_FORM = "admin/RESET_FORM";

export const FETCH_DASHBOARD_REQUEST = "admin/FETCH_DASHBOARD_REQUEST";
export const FETCH_DASHBOARD_SUCCESS = "admin/FETCH_DASHBOARD_SUCCESS";
export const FETCH_DASHBOARD_FAILURE = "admin/FETCH_DASHBOARD_FAILURE";

export const SEND_RESET_LINK_REQUEST = "admin/SEND_RESET_LINK_REQUEST";
export const SEND_RESET_LINK_SUCCESS = "admin/SEND_RESET_LINK_SUCCESS";
export const SEND_RESET_LINK_FAILURE = "admin/SEND_RESET_LINK_FAILURE";

export const RESET_PASSWORD_REQUEST = "admin/RESET_PASSWORD_REQUEST";
export const RESET_PASSWORD_SUCCESS = "admin/RESET_PASSWORD_SUCCESS";
export const RESET_PASSWORD_FAILURE = "admin/RESET_PASSWORD_FAILURE";

// ----- Initial State -----
const initialState = {
  form: { email: "", password: "", newPassword: "", confirmPassword: "" },
  user: null,
  admins: [],
  loading: false,
  error: null,
  successMessage: null,
};

// ----- Reducer -----
export default function adminReducer(state = initialState, action) {
  switch (action.type) {
    case SET_FIELD:
      return {
        ...state,
        form: { ...state.form, [action.payload.field]: action.payload.value },
      };

    case RESET_FORM:
      return { ...state, form: initialState.form };

    // Loading states
    case FETCH_DASHBOARD_REQUEST:
    case SEND_RESET_LINK_REQUEST:
    case RESET_PASSWORD_REQUEST:
      return { ...state, loading: true, error: null, successMessage: null };

    // Success states
    case FETCH_DASHBOARD_SUCCESS:
      return {
        ...state,
        loading: false,
        user: action.payload.user,
        admins: action.payload.admins,
        groups: action.payload.groups,
        error: null,
      };

    case SEND_RESET_LINK_SUCCESS:
    case RESET_PASSWORD_SUCCESS:
      return {
        ...state,
        loading: false,
        successMessage: action.payload,
        error: null,
      };

    // Failure states
    case FETCH_DASHBOARD_FAILURE:
    case SEND_RESET_LINK_FAILURE:
    case RESET_PASSWORD_FAILURE:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}
