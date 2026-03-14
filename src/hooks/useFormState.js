import { useState } from "react";

// Custom hook for managing form state with a setter helper
export function useFormState(initialState) {
  const [form, setForm] = useState(initialState);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  return [form, set, setForm];
}
