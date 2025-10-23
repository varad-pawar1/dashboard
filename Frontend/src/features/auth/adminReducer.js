// ----- Action Types -----
export const SET_FIELD = "admin/SET_FIELD";
export const RESET_FORM = "admin/RESET_FORM";

export const FETCH_USER_REQUEST = "admin/FETCH_USER_REQUEST";
export const FETCH_USER_SUCCESS = "admin/FETCH_USER_SUCCESS";
export const FETCH_USER_FAILURE = "admin/FETCH_USER_FAILURE";

// ----- Initial State -----
const initialState = {
  form: {
    email: "",
    password: "",
  },
  user: null,
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

    // Loading
    case FETCH_USER_REQUEST:
      return { ...state, loading: true, error: null, successMessage: null };

    // Success
    case FETCH_USER_SUCCESS:
      return { ...state, loading: false, user: action.payload };

    // Failure
    case FETCH_USER_FAILURE:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}
