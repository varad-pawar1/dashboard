import { INCREMENT, DECREMENT, RESET } from "./actions";

let initialState = {
  count: 0,
};

export const CounterReducer = (state = initialState, { type }) => {
  switch (type) {
    case "INCREMENT":
      return {
        ...state,
        count: state.count + 1,
      };
    case "DECREMENT":
      return {
        ...state,
        count: state.count - 1,
      };
    case "RESET":
      return {
        ...state,
        count: 0,
      };
    default:
      return state;
  }
};
