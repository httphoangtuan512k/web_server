/**
 * File này: hàm `cn` ghép nhiều className (lớp kiểu dáng) thành một chuỗi, bỏ giá trị rỗng/false.
 * Dùng ở: hầu hết component giao diện.
 */
import clsx, { type ClassValue } from "clsx";

/** Ghép className có điều kiện, vd cn("p-2", chon && "bg-blue"). */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
