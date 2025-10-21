import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { decrement, increment, reset } from "../redux/actions";

export let Counter = () => {
  let count = useSelector((state) => state.count);

  let dispatch = useDispatch();
  return (
    <>
      <button onClick={() => dispatch(increment())}>Inc</button>
      <h1>{count}</h1>
      <button onClick={() => dispatch(decrement())}>Dec</button>
      <button onClick={() => dispatch(reset())}>Reset</button>
    </>
  );
};
