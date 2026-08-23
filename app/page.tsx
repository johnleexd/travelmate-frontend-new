'use client';

import TravelMateLanding from "@/components/TravelMateLanding";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import StyledComponentsRegistry from "@/lib/registry";

export default function Home() {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <TravelMateLanding />
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}

