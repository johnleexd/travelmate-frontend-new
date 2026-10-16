'use client';
import { createContext, useContext } from 'react';
export const ConversionPreference = createContext(true);
export const useConversionEnabled = () => useContext(ConversionPreference);
export const ConversionLoading = createContext(false);
export const useConversionLoading = () => useContext(ConversionLoading);
