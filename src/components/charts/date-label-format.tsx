"use client";

import { createContext, useContext } from "react";
import { shortDateFmt } from "./chart-formatters";

// Local addition (see local-patches.patch): the time-series charts label the
// x axis and the tooltip date pill with a fixed "Oct 11" format in the
// browser's time zone, which is useless for per-minute data. Wrap a chart in
// <DateLabelFormatProvider value={fn}> to use another format.
export type DateLabelFormat = (date: Date) => string;

const defaultFormat: DateLabelFormat = (date) => shortDateFmt.format(date);

const DateLabelFormatContext = createContext<DateLabelFormat>(defaultFormat);

export const DateLabelFormatProvider = DateLabelFormatContext.Provider;

export function useDateLabelFormat(): DateLabelFormat {
  return useContext(DateLabelFormatContext);
}
