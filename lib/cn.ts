import clsx, { type ClassValue } from "clsx";

/** Ghép className có điều kiện. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
