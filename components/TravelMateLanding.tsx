'use client';

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';

// --- Keyframes & Animations ---


// --- Custom SVGs ---
const TravelMateLogo = () => (
  <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#F59E0B" />
    <path d="M14 11V7C14 5.89543 14.8954 5 16 5H24C25.1046 5 26 5.89543 26 7V11" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="8" y="11" width="24" height="18" rx="4" stroke="#0f172a" strokeWidth="2.2" fill="rgba(255,255,255,0.1)" />
    <circle cx="20" cy="20" r="5" fill="#0f172a" />
    <circle cx="20" cy="20" r="2" fill="#F59E0B" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c0 4.5 3.5 8 8 8-4.5 0-8 3.5-8 8 0-4.5-3.5-8-8-8 4.5 0 8-3.5 8-8z" fill="currentColor" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// --- Styled Components ---

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
`;

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
  70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
`;

const scrollBounce = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(6px); }
`;

const counterUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  font-family: ${props => props.theme.fonts.main};
  background-color: #020617;
  color: #1e293b;
  overflow-x: hidden;
`;

// --- Dark Glassmorphism Navbar ---
const Header = styled.header`
  width: 100%;
  padding: 18px 40px;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  position: fixed;
  top: 0;
  z-index: 200;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.3s ease;

  @media (max-width: 768px) {
    padding: 14px 20px;
  }
`;

const HeaderInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;
`;

const LogoText = styled.span`
  font-size: 1.3rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
`;

const NavCenter = styled.nav`
  display: flex;
  gap: 32px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);

  @media (max-width: 900px) {
    display: none;
  }
`;

const NavLink = styled.a`
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: color 0.2s ease;
  cursor: pointer;
  &:hover {
    color: #ffffff;
  }
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NavSignInBtn = styled.button`
  font-size: 0.875rem;
  font-weight: 600;
  padding: 9px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
  &:active { transform: translateY(0); }
`;

const NavTryFreeBtn = styled.button`
  font-size: 0.875rem;
  font-weight: 700;
  padding: 9px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: #F59E0B;
  color: #0f172a;
  border: none;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);

  &:hover {
    background: #FBBF24;
    transform: translateY(-1.5px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
  }
  &:active { transform: translateY(0); }
`;

// Legacy Button kept for sections below the hero
const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'outline' }>`
  font-size: 0.875rem;
  font-weight: 700;
  padding: ${props => props.$variant === 'primary' ? '12px 24px' : '10px 20px'};
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  @keyframes pulseGlowAmber {
    0%   { box-shadow: 0 0 0 0   rgba(245, 158, 11, 0.45); }
    70%  { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); }
    100% { box-shadow: 0 0 0 0   rgba(245, 158, 11, 0); }
  }

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: #F59E0B;
          color: #0f172a;
          border: none;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
          animation: pulseGlowAmber 2.5s infinite;
          &:hover {
            background: #FBBF24;
            transform: translateY(-1.5px);
          }
        `;
      case 'outline':
        return `
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          &:hover {
            background: rgba(255, 255, 255, 0.14);
            border-color: rgba(255, 255, 255, 0.4);
            transform: translateY(-1.5px);
          }
        `;
      default:
        return `
          background: #ffffff;
          color: #1a73e8;
          border: 1.5px solid #e8f0fe;
          box-shadow: 0 2px 4px rgba(0,0,0,0.03);
          &:hover {
            background: #e8f0fe;
            transform: translateY(-1px);
          }
        `;
    }
  }}
`;

// kept for backward compat in CTA section
const SignUpNavButton = NavTryFreeBtn;


// ============================================================
// Section 2: Hero — New Cinematic Dark Design
// ============================================================
const HeroContainer = styled.section`
  position: relative;
  width: 100%;
  min-height: 100vh;
  background:
    linear-gradient(180deg,
      rgba(2, 6, 23, 0.55) 0%,
      rgba(2, 6, 23, 0.40) 40%,
      rgba(2, 6, 23, 0.72) 80%,
      rgba(2, 6, 23, 0.92) 100%
    ),
    url('/mountain-hero-bg.png') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding-top: 120px;
  overflow: hidden;

  @media (max-width: 768px) {
    padding-top: 100px;
    background-attachment: scroll;
  }
`;

const HeroContent = styled.div`
  max-width: 820px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 32px;
  flex: 1;
  justify-content: center;
  animation: ${fadeUp} 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (max-width: 768px) {
    padding: 0 20px;
  }
`;

const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 9999px;
  padding: 7px 18px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #FCD34D;
  letter-spacing: 0.5px;
  margin-bottom: 32px;
  backdrop-filter: blur(8px);
`;

const HeroBadgeDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F59E0B;
  display: inline-block;
  flex-shrink: 0;
`;

const HeroTitle = styled.h1`
  font-size: clamp(3rem, 7vw, 5.5rem);
  font-weight: 900;
  line-height: 1.08;
  color: #ffffff;
  letter-spacing: -2px;
  margin-bottom: 0;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);

  @media (max-width: 768px) {
    font-size: 2.8rem;
    letter-spacing: -1.5px;
  }
`;

const HeroTitleAccent = styled.div`
  font-size: clamp(3rem, 7vw, 5.5rem);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -2px;
  background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #FCD34D 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 28px;

  @media (max-width: 768px) {
    font-size: 2.8rem;
    letter-spacing: -1.5px;
  }
`;

const HeroSubtitle = styled.p`
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.65;
  max-width: 600px;
  margin-bottom: 40px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const HeroButtons = styled.div`
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 80px;

  @media (max-width: 576px) {
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 360px;
  }
`;

const HeroPrimaryBtn = styled.button`
  font-size: 1rem;
  font-weight: 700;
  padding: 14px 28px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #F59E0B;
  color: #0f172a;
  border: none;
  box-shadow: 0 6px 24px rgba(245, 158, 11, 0.45);
  animation: ${pulseGlow} 2.5s infinite;
  white-space: nowrap;

  &:hover {
    background: #FBBF24;
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(245, 158, 11, 0.55);
  }
  &:active { transform: translateY(0); }

  @media (max-width: 576px) {
    width: 100%;
    justify-content: center;
  }
`;

const HeroSecondaryBtn = styled.button`
  font-size: 1rem;
  font-weight: 600;
  padding: 14px 28px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.35);
    transform: translateY(-2px);
  }
  &:active { transform: translateY(0); }

  @media (max-width: 576px) {
    width: 100%;
    justify-content: center;
  }
`;

// --- Metrics Row ---
const HeroMetricsBar = styled.div`
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(20px);
  padding: 28px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;

  @media (max-width: 768px) {
    padding: 20px 16px;
    flex-wrap: wrap;
    gap: 0;
  }
`;

const MetricItem = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  position: relative;
  animation: ${counterUp} 0.8s ease both;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 10%;
    height: 80%;
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    flex: 0 0 50%;
    padding: 12px 0;
    &:not(:last-child)::after { display: none; }
  }
`;

const MetricValue = styled.div`
  font-size: 1.75rem;
  font-weight: 800;
  color: #F59E0B;
  letter-spacing: -0.5px;
  line-height: 1.1;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const MetricLabel = styled.div`
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 500;
  margin-top: 4px;
`;

const ScrollIndicator = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);

  @media (max-width: 768px) {
    display: none;
  }
`;

const ScrollLabel = styled.span`
  font-size: 0.65rem;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  font-weight: 600;
`;

const ScrollChevron = styled.div`
  color: rgba(255, 255, 255, 0.4);
  animation: ${scrollBounce} 1.8s ease-in-out infinite;
`;

// Spacer for keeping older styled-component HeroLeft references in budget section
const HeroLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  @media (max-width: 1024px) {
    align-items: center;
  }
`;

// ============================================================
// Three Portals Section Styled Components
// ============================================================
const PortalsSection = styled.section`
  background: #020617;
  padding: 96px 32px 80px 32px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.08) 30%,
      rgba(255, 255, 255, 0.12) 50%,
      rgba(255, 255, 255, 0.08) 70%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 64px 20px 56px 20px;
  }
`;

const PortalsInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const PortalsSectionBadge = styled.div`
  text-align: center;
  margin-bottom: 16px;
`;

const PortalsRoleBadge = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  padding: 5px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  backdrop-filter: blur(8px);
`;

const PortalsSectionTitle = styled.h2`
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 800;
  color: #f1f5f9;
  text-align: center;
  letter-spacing: -0.75px;
  margin-bottom: 56px;
  margin-top: 14px;

  @media (max-width: 768px) {
    margin-bottom: 36px;
  }
`;

const PortalsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    max-width: 480px;
    margin: 0 auto;
  }
`;

const PortalCard = styled.div<{ $accent: 'teal' | 'teal-active' | 'purple' }>`
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: default;

  border: 1px solid ${
    props =>
      props.$accent === 'purple'
        ? 'rgba(139, 92, 246, 0.3)'
        : props.$accent === 'teal-active'
        ? 'rgba(20, 184, 166, 0.55)'
        : 'rgba(20, 184, 166, 0.2)'
  };

  box-shadow: ${
    props =>
      props.$accent === 'purple'
        ? '0 0 0 1px rgba(139, 92, 246, 0.08), inset 0 1px 0 rgba(139, 92, 246, 0.06)'
        : props.$accent === 'teal-active'
        ? '0 0 24px rgba(20, 184, 166, 0.12), 0 0 0 1px rgba(20, 184, 166, 0.1)'
        : '0 0 0 1px rgba(20, 184, 166, 0.04), inset 0 1px 0 rgba(20, 184, 166, 0.04)'
  };

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${
      props =>
        props.$accent === 'purple'
          ? '0 20px 40px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)'
          : '0 20px 40px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.25)'
    };
  }
`;

const PortalIconBox = styled.div<{ $accent: 'teal' | 'teal-active' | 'purple' }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  background: ${
    props =>
      props.$accent === 'purple'
        ? 'rgba(139, 92, 246, 0.08)'
        : 'rgba(20, 184, 166, 0.08)'
  };
  border: 1px solid ${
    props =>
      props.$accent === 'purple'
        ? 'rgba(139, 92, 246, 0.18)'
        : 'rgba(20, 184, 166, 0.18)'
  };
  flex-shrink: 0;
`;

const PortalCardTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
  letter-spacing: -0.25px;
`;

const PortalCardDesc = styled.p`
  font-size: 0.875rem;
  color: rgba(148, 163, 184, 0.85);
  line-height: 1.55;
  margin: 0;
  flex: 1;
`;

const PortalEnterBtn = styled.button<{ $accent: 'teal' | 'teal-active' | 'purple' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 9px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.22s ease;
  align-self: flex-start;
  margin-top: 4px;

  background: ${
    props =>
      props.$accent === 'purple'
        ? 'rgba(139, 92, 246, 0.12)'
        : props.$accent === 'teal-active'
        ? 'rgba(20, 184, 166, 0.18)'
        : 'rgba(255, 255, 255, 0.05)'
  };
  color: ${
    props =>
      props.$accent === 'purple'
        ? '#a78bfa'
        : props.$accent === 'teal-active'
        ? '#5eead4'
        : 'rgba(255,255,255,0.6)'
  };
  border: 1px solid ${
    props =>
      props.$accent === 'purple'
        ? 'rgba(139, 92, 246, 0.3)'
        : props.$accent === 'teal-active'
        ? 'rgba(20, 184, 166, 0.4)'
        : 'rgba(255, 255, 255, 0.12)'
  };

  &:hover {
    background: ${
      props =>
        props.$accent === 'purple'
          ? 'rgba(139, 92, 246, 0.22)'
          : props.$accent === 'teal-active'
          ? 'rgba(20, 184, 166, 0.28)'
          : 'rgba(255, 255, 255, 0.1)'
    };
    transform: translateY(-1px);
  }
  &:active { transform: translateY(0); }
`;

// Common Layout components
const SectionWrapper = styled.section`
  max-width: 1200px;
  margin: 0 auto;
  padding: 100px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 768px) {
    padding: 60px 20px;
  }
`;

// ============================================================
// Core Features Section
// ============================================================
const CoreFeaturesSection = styled.section`
  background: #020617;
  padding: 96px 32px 80px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.07) 30%,
      rgba(255,255,255,0.11) 50%,
      rgba(255,255,255,0.07) 70%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 64px 20px 56px;
  }
`;

const CoreFeaturesInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const CoreFeaturesHeader = styled.div`
  text-align: center;
  margin-bottom: 56px;

  @media (max-width: 768px) {
    margin-bottom: 36px;
  }
`;

const CoreFeaturesBadge = styled.span`
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 3.5px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: 16px;
`;

const CoreFeaturesTitle = styled.h2`
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.75px;
  line-height: 1.2;
  margin: 0;
`;

const CoreFeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled.div`
  background: rgba(15, 23, 42, 0.60);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  padding: 36px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(255,255,255,0.13);
    box-shadow: 0 20px 40px rgba(0,0,0,0.25);
  }
`;

const FeatureIconBadge = styled.div<{ $color: 'amber' | 'teal' | 'blue' | 'purple' }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;

  background: ${
    props => {
      if (props.$color === 'amber')  return 'rgba(245,158,11,0.12)';
      if (props.$color === 'teal')   return 'rgba(20,184,166,0.12)';
      if (props.$color === 'blue')   return 'rgba(99,102,241,0.12)';
      return 'rgba(139,92,246,0.12)';
    }
  };
  border: 1px solid ${
    props => {
      if (props.$color === 'amber')  return 'rgba(245,158,11,0.25)';
      if (props.$color === 'teal')   return 'rgba(20,184,166,0.25)';
      if (props.$color === 'blue')   return 'rgba(99,102,241,0.25)';
      return 'rgba(139,92,246,0.25)';
    }
  };
`;

const FeatureCardTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
  letter-spacing: -0.2px;
`;

const FeatureCardDesc = styled.p`
  font-size: 0.875rem;
  color: rgba(148,163,184,0.8);
  line-height: 1.6;
  margin: 0;
`;

const SectionHeader = styled.div`
  text-align: center;
  max-width: 700px;
  margin-bottom: 56px;
`;

// ============================================================
// How It Works Section
// ============================================================
const HowItWorksSection = styled.section`
  background: #020617;
  padding: 96px 32px 88px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.07) 30%,
      rgba(255,255,255,0.11) 50%,
      rgba(255,255,255,0.07) 70%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 64px 20px 56px;
  }
`;

const HowItWorksInner = styled.div`
  max-width: 1000px;
  margin: 0 auto;
`;

const HowItWorksHeader = styled.div`
  text-align: center;
  margin-bottom: 64px;

  @media (max-width: 768px) {
    margin-bottom: 40px;
  }
`;

const HowItWorksBadge = styled.span`
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.32);
  font-family: 'Courier New', Courier, monospace;
  margin-bottom: 18px;
`;

const HowItWorksTitle = styled.h2`
  font-size: clamp(1.7rem, 4vw, 2.5rem);
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.75px;
  line-height: 1.2;
  margin: 0;
`;

const HowItWorksGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  position: relative;

  /* subtle connector lines between steps on desktop */
  @media (min-width: 769px) {
    &::before {
      content: '';
      position: absolute;
      top: 36px;
      left: calc(16.66% + 22px);
      right: calc(16.66% + 22px);
      height: 1px;
      background: linear-gradient(
        90deg,
        rgba(245,158,11,0.25) 0%,
        rgba(245,158,11,0.5) 50%,
        rgba(245,158,11,0.25) 100%
      );
      pointer-events: none;
    }
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 48px;
  }
`;

const HowItWorksStep = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  position: relative;
  z-index: 1;
`;

const StepIconBadge = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.8);
  border: 1.5px solid rgba(245, 158, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  box-shadow:
    0 0 0 6px rgba(245,158,11,0.05),
    0 8px 24px rgba(0,0,0,0.3);
  flex-shrink: 0;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;

  ${HowItWorksStep}:hover & {
    border-color: rgba(245,158,11,0.75);
    box-shadow:
      0 0 0 6px rgba(245,158,11,0.1),
      0 12px 32px rgba(0,0,0,0.35);
  }
`;

const StepNumber = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: rgba(245,158,11,0.5);
  font-family: 'Courier New', Courier, monospace;
`;

const HowItWorksStepTitle = styled.h3`
  font-size: 1.05rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
  letter-spacing: -0.15px;
`;

const HowItWorksStepDesc = styled.p`
  font-size: 0.875rem;
  color: rgba(148,163,184,0.78);
  line-height: 1.6;
  margin: 0;
  max-width: 260px;
`;

// ============================================================
// User Reviews Section
// ============================================================
const UserReviewsSection = styled.section`
  background: #020617;
  padding: 96px 32px 88px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.07) 30%,
      rgba(255,255,255,0.11) 50%,
      rgba(255,255,255,0.07) 70%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 64px 20px 56px;
  }
`;

const UserReviewsInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const UserReviewsHeader = styled.div`
  text-align: center;
  margin-bottom: 56px;

  @media (max-width: 768px) {
    margin-bottom: 36px;
  }
`;

const UserReviewsBadge = styled.span`
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.32);
  font-family: 'Courier New', Courier, monospace;
  margin-bottom: 18px;
`;

const UserReviewsTitle = styled.h2`
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.75px;
  line-height: 1.2;
  margin: 0;
`;

const UserReviewsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ReviewCard = styled.div`
  background: rgba(15, 23, 42, 0.60);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(245, 158, 11, 0.25);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  }
`;

const RatingStars = styled.div`
  display: flex;
  gap: 4px;
  color: #fbbf24;
  font-size: 1.1rem;
`;

const ReviewQuote = styled.p`
  font-size: 0.925rem;
  color: rgba(148, 163, 184, 0.85);
  line-height: 1.65;
  margin: 0;
  flex: 1;
`;

const UserMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`;

const UserAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.15);
  color: #F59E0B;
  border: 1px solid rgba(245, 158, 11, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.825rem;
  flex-shrink: 0;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const UserName = styled.span`
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
`;

const UserRole = styled.span`
  font-size: 0.78rem;
  color: rgba(148, 163, 184, 0.7);
`;

// ============================================================
// Final CTA Banner & Minimal Footer
// ============================================================
const FinalCtaSection = styled.section`
  background: #020617;
  padding: 96px 32px 80px;
  text-align: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.07) 30%,
      rgba(255,255,255,0.11) 50%,
      rgba(255,255,255,0.07) 70%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    padding: 64px 20px 56px;
  }
`;

const FinalCtaInner = styled.div`
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FinalCtaTitle = styled.h2`
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.75px;
  line-height: 1.25;
  margin: 0 0 16px 0;
`;

const FinalCtaSubtitle = styled.p`
  font-size: clamp(0.95rem, 2vw, 1.1rem);
  color: rgba(148, 163, 184, 0.85);
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto 36px auto;
`;

const FinalCtaButton = styled.button`
  font-size: 1rem;
  font-weight: 700;
  padding: 16px 32px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #F59E0B;
  color: #0f172a;
  border: none;
  box-shadow: 0 6px 24px rgba(245, 158, 11, 0.35);

  &:hover {
    background: #FBBF24;
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(245, 158, 11, 0.45);
  }
  &:active { transform: translateY(0); }
`;

const BottomFooterBar = styled.footer`
  background: #020617;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px 32px;
`;

const BottomFooterInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
`;

const BottomFooterCopyright = styled.span`
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.5);
  font-family: 'Courier New', Courier, monospace;
`;

const SectionPreTitle = styled.span`
  color: #F59E0B;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  display: block;
  margin-bottom: 12px;
`;

const SectionTitle = styled.h2`
  font-size: 2.25rem;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.5px;
  margin-bottom: 16px;

  @media (max-width: 768px) {
    font-size: 1.85rem;
  }
`;

const SectionDesc = styled.p`
  font-size: 1rem;
  color: rgba(148, 163, 184, 0.85);
  line-height: 1.6;
`;

// Section 3: Problem Section
const ProblemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const ProblemCard = styled.div`
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 36px;
  backdrop-filter: blur(12px);
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.3);
    border-color: rgba(245, 158, 11, 0.2);
  }
`;

const ProblemIcon = styled.div`
  width: 48px;
  height: 48px;
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  font-size: 1.25rem;
  border: 1px solid rgba(245, 158, 11, 0.2);
`;

const ProblemCardTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 12px;
`;

const ProblemCardDesc = styled.p`
  font-size: 0.95rem;
  color: rgba(148, 163, 184, 0.8);
  line-height: 1.5;
`;

// Section 4 & 5: How It Works Paths
const StepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  width: 100%;
  margin-top: 20px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StepItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(12px);
  transition: border-color 0.25s ease, transform 0.25s ease;

  &:hover {
    border-color: rgba(245, 158, 11, 0.25);
    transform: translateY(-2px);
  }
`;

const StepNumberBadge = styled.div<{ $isHost?: boolean }>`
  width: 32px;
  height: 32px;
  background: ${props => props.$isHost ? 'rgba(20,184,166,0.15)' : 'rgba(245,158,11,0.15)'};
  color: ${props => props.$isHost ? '#5eead4' : '#F59E0B'};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 16px;
  border: 1px solid ${props => props.$isHost ? 'rgba(20,184,166,0.3)' : 'rgba(245,158,11,0.3)'};
`;

const StepTitle = styled.h4`
  font-size: 1rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 8px;
`;

const StepDesc = styled.p`
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.8);
  line-height: 1.45;
`;

// Section 6: Budget Engine Explainer
const BudgetExplainerGrid = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  width: 100%;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const BudgetPanelMock = styled.div`
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(245, 158, 11, 0.18);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
`;

const MockInputHeader = styled.div`
  background: rgba(2, 6, 23, 0.6);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  border: 1px solid rgba(255,255,255,0.08);
`;

const MockPanelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MockDayRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(2, 6, 23, 0.5);
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  font-size: 0.9rem;
`;

const MockDayLabel = styled.span`
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MockDayActivity = styled.span`
  color: rgba(148,163,184,0.8);
  font-size: 0.85rem;
`;

const MockDayBudget = styled.span`
  font-weight: 700;
  color: #F59E0B;
`;

const WeatherAlertMock = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const WeatherIcon = styled.div`
  font-size: 1.5rem;
`;

const WeatherContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const WeatherTitle = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: #b45309;
`;

const WeatherDesc = styled.p`
  font-size: 0.8rem;
  color: #d97706;
  margin: 0;
  line-height: 1.4;
`;

// Section 7: Trust & Safety
const TrustGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  width: 100%;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const TrustCard = styled.div`
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  backdrop-filter: blur(12px);
  transition: border-color 0.25s ease, transform 0.25s ease;

  &:hover {
    border-color: rgba(245, 158, 11, 0.2);
    transform: translateY(-2px);
  }
`;

const TrustTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 12px;
`;

const TrustDesc = styled.p`
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.8);
  line-height: 1.55;
`;

const TrustIcon = styled.div<{ $variant: 'green' | 'blue' | 'purple' }>`
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  margin: 0 auto 20px auto;
  background: ${props => {
    if (props.$variant === 'green') return '#ecfdf5';
    if (props.$variant === 'purple') return '#faf5ff';
    return '#eff6ff';
  }};
  color: ${props => {
    if (props.$variant === 'green') return '#10b981';
    if (props.$variant === 'purple') return '#a855f7';
    return '#3b82f6';
  }};
`;

// Section 8: Comparison Table
const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  backdrop-filter: blur(12px);
`;

const CompareTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 600px;
`;

const Th = styled.th`
  background: rgba(2, 6, 23, 0.5);
  padding: 18px 24px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #f1f5f9;
  border-bottom: 1px solid rgba(255,255,255,0.07);
`;

const Td = styled.td`
  padding: 18px 24px;
  font-size: 0.9rem;
  color: rgba(148,163,184,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.05);
`;

const CheckIcon = styled.span`
  color: #34d399;
  font-weight: bold;
  margin-right: 6px;
`;

// Section 9: Platform Preview
const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 1.25fr 0.75fr;
  gap: 32px;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const PreviewCard = styled.div`
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(12px);
`;

const PreviewTitle = styled.h4`
  font-size: 1rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MockBadge = styled.span<{ $status?: string }>`
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 9999px;
  font-weight: 700;
  background: ${props => props.$status === 'ONGOING' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)'};
  color: ${props => props.$status === 'ONGOING' ? '#60a5fa' : '#34d399'};
`;

const ChatBubble = styled.div<{ $isSender?: boolean }>`
  background: ${props => props.$isSender ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)'};
  color: ${props => props.$isSender ? '#FCD34D' : 'rgba(226,232,240,0.85)'};
  border: 1px solid ${props => props.$isSender ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'};
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 80%;
  align-self: ${props => props.$isSender ? 'flex-end' : 'flex-start'};
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 10px;
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 200px;
`;

const SystemMessage = styled.div`
  font-size: 0.75rem;
  color: rgba(148,163,184,0.6);
  align-self: center;
  margin: 12px 0;
  background: rgba(255,255,255,0.04);
  padding: 4px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.07);
  font-weight: 600;
`;

// Section 10: FAQ Accordion
const FaqList = styled.div`
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FaqItem = styled.div`
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  transition: border-color 0.25s ease;
  &:hover {
    border-color: rgba(245, 158, 11, 0.25);
  }
`;

const FaqQuestion = styled.button`
  width: 100%;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f1f5f9;
  text-align: left;
  cursor: pointer;
  outline: none;
`;

const FaqAnswer = styled.div<{ $isOpen: boolean }>`
  max-height: ${props => props.$isOpen ? '200px' : '0px'};
  padding: ${props => props.$isOpen ? '0 24px 24px 24px' : '0 24px'};
  overflow: hidden;
  transition: all 0.25s ease;
  font-size: 0.95rem;
  color: rgba(148, 163, 184, 0.85);
  line-height: 1.55;
`;

// Section 11: Dual CTA
const CtaContainer = styled.section`
  max-width: 1200px;
  margin: 0 auto 60px auto;
  padding: 0 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: 0 20px;
  }
`;

const CtaBox = styled.div<{ $variant?: 'blue' | 'light' }>`
  border-radius: 24px;
  padding: 48px;
  color: #ffffff;
  background: ${props => props.$variant === 'light'
    ? 'rgba(15, 23, 42, 0.7)'
    : 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 100%)'};
  border: 1px solid ${props => props.$variant === 'light'
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(245, 158, 11, 0.35)'};
  backdrop-filter: blur(12px);
  box-shadow: ${props => props.$variant !== 'light' ? '0 0 40px rgba(245,158,11,0.08)' : 'none'};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
`;

const CtaTitle = styled.h3`
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.5px;
  color: #f1f5f9;
`;

const CtaDesc = styled.p`
  font-size: 1rem;
  line-height: 1.55;
  margin: 0;
  color: rgba(148, 163, 184, 0.85);
`;

// Section 12: Footer
const FooterContainer = styled.footer`
  background: #0f172a;
  color: #94a3b8;
  padding: 80px 32px 40px 32px;
  border-top: 1px solid #1e293b;

  @media (max-width: 768px) {
    padding: 60px 20px 30px 20px;
  }
`;

const FooterInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
`;

const FooterMain = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 48px;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FooterLogoText = styled.span`
  font-size: 1.3rem;
  font-weight: 800;
  color: #ffffff;
  span {
    color: #3b82f6;
  }
`;

const FooterRegionsText = styled.p`
  font-size: 0.85rem;
  line-height: 1.5;
  color: #64748b;
  margin: 0;
`;

const FooterLinksCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FooterColTitle = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 1.5px;
`;

const FooterLink = styled.a`
  font-size: 0.85rem;
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.2s ease;
  &:hover {
    color: #ffffff;
  }
`;

const FooterBottom = styled.div`
  border-top: 1px solid #1e293b;
  padding-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #64748b;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

const ModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

// ============================================================
// Redesigned Auth Modal Styled Components
// ============================================================
const ModalBackdropNew = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: ${fadeIn} 0.25s ease;
`;

const ModalCardNew = styled.div`
  width: 100%;
  max-width: 440px;
  background: #0d1322;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  position: relative;
  display: flex;
  flex-direction: column;
`;

const ModalHeaderNew = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const ModalCloseBtnNew = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: #f1f5f9;
  }
`;

const TabPillContainer = styled.div`
  background: #151c2e;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 4px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-top: 24px;
  margin-bottom: 24px;
`;

const TabPillBtn = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#232d42' : 'transparent'};
  color: ${props => props.$active ? '#ffffff' : '#94a3b8'};
  font-weight: ${props => props.$active ? '700' : '600'};
  border-radius: 10px;
  padding: 10px 0;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;

  &:hover {
    color: #ffffff;
  }
`;

const RoleLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #94a3b8;
  text-transform: uppercase;
  font-family: 'Courier New', Courier, monospace;
  margin-bottom: 10px;
  display: block;
`;

const RoleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 24px;
`;

const RoleCardBtn = styled.button<{ $selected: boolean }>`
  background: #151c2e;
  border: 1.5px solid ${props => props.$selected ? '#f59e0b' : 'rgba(255, 255, 255, 0.06)'};
  color: ${props => props.$selected ? '#f59e0b' : '#94a3b8'};
  padding: 14px 8px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${props => props.$selected ? '0 0 16px rgba(245, 158, 11, 0.15)' : 'none'};

  &:hover {
    border-color: ${props => props.$selected ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)'};
    color: ${props => props.$selected ? '#f59e0b' : '#f1f5f9'};
  }
`;

const RoleIcon = styled.span`
  font-size: 1.2rem;
`;

const RoleName = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
`;

const FormLabelNew = styled.label`
  font-size: 0.825rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 6px;
  display: block;
`;

const FormInputNew = styled.input`
  width: 100%;
  background: #151c2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  font-size: 0.9rem;
  border-radius: 12px;
  padding: 12px 16px;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: #f59e0b;
  }

  &::placeholder {
    color: #64748b;
  }
`;

const PrimarySubmitBtnNew = styled.button`
  width: 100%;
  background: #f59e0b;
  color: #0f172a;
  font-weight: 700;
  font-size: 1rem;
  border-radius: 12px;
  padding: 14px 0;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);

  &:hover {
    background: #fbbf24;
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const BottomSwitchText = styled.p`
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;

  span {
    color: #f59e0b;
    font-weight: 700;
    cursor: pointer;
    margin-left: 4px;
    &:hover {
      text-decoration: underline;
    }
  }
`;

const ModalCard = styled.div`
  width: 100%;
  max-width: 900px;
  background: #ffffff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 580px;
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 480px;
    min-height: auto;
  }
`;

const ModalLeft = styled.div`
  background: linear-gradient(135deg, #1a73e8 0%, #0d5bb5 100%);
  color: #ffffff;
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;

  @media (max-width: 768px) {
    display: none;
  }
`;

const ModalLeftContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const VerifiedBadge = styled.div`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
`;

const ModalLeftTitle = styled.h3`
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.25;
  margin: 0;
  letter-spacing: -0.5px;
`;

const ModalLeftDesc = styled.p`
  font-size: 0.95rem;
  line-height: 1.5;
  opacity: 0.9;
  margin: 0;
`;

const ModalRight = styled.div`
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;

  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 24px;
  right: 24px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  transition: color 0.2s ease;
  &:hover {
    color: #475569;
  }
`;

const FormTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
`;

const FormSubtitle = styled.p`
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 24px 0;
  a {
    color: #1a73e8;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }
`;

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 0.9rem;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s ease;
  &:focus {
    border-color: #1a73e8;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 0.9rem;
  color: #1e293b;
  outline: none;
  background-color: #ffffff;
  transition: border-color 0.2s ease;
  &:focus {
    border-color: #1a73e8;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 0.9rem;
  color: #1e293b;
  outline: none;
  resize: none;
  height: 80px;
  transition: border-color 0.2s ease;
  &:focus {
    border-color: #1a73e8;
  }
`;

const StepperHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: #f8fafc;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const StepperTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const StepperDots = styled.div`
  display: flex;
  gap: 6px;
`;

const StepperDot = styled.div<{ active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.active ? '#1a73e8' : '#e2e8f0'};
`;

const GoogleButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 10px 0;
  &::before, &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e2e8f0;
  }
  &:not(:empty)::before {
    margin-right: .5em;
  }
  &:not(:empty)::after {
    margin-left: .5em;
  }
`;

const AvatarContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 4px;
`;

const AvatarOption = styled.div<{ selected: boolean }>`
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid ${props => props.selected ? '#1a73e8' : 'transparent'};
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  &:hover {
    transform: scale(1.05);
    background: #e2e8f0;
  }
`;

const ErrorMsg = styled.span`
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 600;
`;

const SuccessPanel = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
`;

const SuccessIcon = styled.div`
  width: 56px;
  height: 56px;
  background: #ecfdf5;
  color: #10b981;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
`;

export default function TravelMateLanding() {
  const router = useRouter();
  // FAQs State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<'traveller' | 'destination' | 'system'>('traveller');

  // Form Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRegion, setRegRegion] = useState('Southeast Asia');
  const [regAvatar, setRegAvatar] = useState('🌴');
  const [regBio, setRegBio] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');

  // UI States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Handlers
  const handleOpenAuth = (view: 'login' | 'register') => {
    setAuthView(view);
    setRegisterStep(1);
    setIsAuthOpen(true);
    setShowSuccess(false);
    setErrors({});
    // Reset inputs
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegPhone('');
    setRegRegion('Southeast Asia');
    setRegAvatar('🌴');
    setRegBio('');
    setForgotEmail('');
  };

  const handleCloseAuth = () => {
    setIsAuthOpen(false);
  };

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!loginEmail) newErrors.loginEmail = 'Email is required';
    else if (!validateEmail(loginEmail)) newErrors.loginEmail = 'Please enter a valid email';
    if (!loginPassword) newErrors.loginPassword = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const roleCookie = selectedRole === 'destination' ? 'owner' : (selectedRole === 'system' ? 'admin' : 'traveler');
    document.cookie = `auth_token=simulated_token_for_${loginEmail}; path=/; max-age=3600; SameSite=Lax`;
    document.cookie = `user_role=${roleCookie}; path=/; max-age=3600; SameSite=Lax`;

    setSuccessMsg(`Successfully logged in as ${selectedRole}! Redirecting...`);
    setShowSuccess(true);
    setTimeout(() => {
      setIsAuthOpen(false);
      if (selectedRole === 'system') {
        router.push('/admin/dashboard');
      } else if (selectedRole === 'destination') {
        router.push('/owner/dashboard');
      } else {
        router.push('/dashboard');
      }
    }, 1200);
  };

  const handleRegisterNext = () => {
    const newErrors: Record<string, string> = {};

    if (registerStep === 1) {
      if (!regName) newErrors.regName = 'Name is required';
      if (!regEmail) newErrors.regEmail = 'Email is required';
      else if (!validateEmail(regEmail)) newErrors.regEmail = 'Please enter a valid email';
      
      // Password validation: min 8 characters, at least 1 number
      if (!regPassword) {
        newErrors.regPassword = 'Password is required';
      } else {
        if (regPassword.length < 8) {
          newErrors.regPassword = 'Password must be at least 8 characters long';
        }
        if (!/\d/.test(regPassword)) {
          newErrors.regPassword = (newErrors.regPassword ? newErrors.regPassword + '. ' : '') + 'Password must contain at least 1 number';
        }
      }
    } else if (registerStep === 2) {
      if (!regPhone) {
        newErrors.regPhone = 'Phone number is required';
      } else {
        // Validation: simple local or international format
        const phoneRegex = /^\+?[0-9\s\-()]{7,15}$/;
        if (!phoneRegex.test(regPhone)) {
          newErrors.regPhone = 'Please enter a valid phone number';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setRegisterStep((prev) => (prev + 1) as 1 | 2 | 3);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!regEmail) newErrors.regEmail = 'Email is required';
    else if (!validateEmail(regEmail)) newErrors.regEmail = 'Please enter a valid email';
    if (!regPassword) newErrors.regPassword = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const roleCookie = selectedRole === 'destination' ? 'owner' : (selectedRole === 'system' ? 'admin' : 'traveler');
    document.cookie = `auth_token=simulated_token_for_${regEmail}; path=/; max-age=3600; SameSite=Lax`;
    document.cookie = `user_role=${roleCookie}; path=/; max-age=3600; SameSite=Lax`;

    setSuccessMsg(`Account created as ${selectedRole}! Redirecting to dashboard...`);
    setShowSuccess(true);
    setTimeout(() => {
      setIsAuthOpen(false);
      if (selectedRole === 'system') {
        router.push('/admin/dashboard');
      } else if (selectedRole === 'destination') {
        router.push('/owner/dashboard');
      } else {
        router.push('/dashboard');
      }
    }, 1200);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!forgotEmail) newErrors.forgotEmail = 'Email is required';
    else if (!validateEmail(forgotEmail)) newErrors.forgotEmail = 'Please enter a valid email';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Secure generic message to prevent email enumeration
    setSuccessMsg('If the account exists, a reset link has been sent to your email.');
    setShowSuccess(true);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Mock FAQ Data
  const faqs = [
    {
      q: "How does the budget-splitting algorithm work?",
      a: "Our algorithm takes your total input budget and automatically splits it proportionally across accommodation, activities, dining, transport, and a pre-calculated safety reserve. This ensures that you have a completely optimized plan with zero financial surprises."
    },
    {
      q: "Is email verification mandatory for logging in?",
      a: "Yes. For manual email/password registrations, you must verify your email address to confirm ownership and activate your dashboard. First-time Google Sign-In users are verified automatically by Google."
    },
    {
      q: "Can I cancel my itinerary booking after the travel starts?",
      a: "No direct cancellations are allowed once the trip began duration begins. At that stage, you can submit a Cancellation or Modification Request. If the destination owner declines, it escalates to the admin dispute review queue."
    },
    {
      q: "What is the Profile Trust Score system?",
      a: "The Trust Score is a dynamic system rating accounts from 0 to 100 (starting at 50). Successful verifications and bookings raise your trust score, while at-fault cancellations or user complaints will decrease it."
    }
  ];

  return (
    <PageContainer>
      {/* ── Dark Glass Navbar ── */}
      <Header>
        <HeaderInner>
          <LogoContainer>
            <TravelMateLogo />
            <LogoText>TravelMate</LogoText>
          </LogoContainer>

          <NavCenter>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#reviews">Reviews</NavLink>
          </NavCenter>

          <NavActions>
            <NavSignInBtn id="nav-signin-btn" onClick={() => handleOpenAuth('login')}>Sign In</NavSignInBtn>
            <NavTryFreeBtn id="nav-tryfree-btn" onClick={() => handleOpenAuth('register')}>Try Free</NavTryFreeBtn>
          </NavActions>
        </HeaderInner>
      </Header>

      {/* ── Cinematic Hero Section ── */}
      <HeroContainer id="hero">
        <HeroContent>
          {/* Pill badge */}
          <HeroBadge>
            <HeroBadgeDot />
            AI-Powered Travel Planning · 2026
          </HeroBadge>

          {/* Headline */}
          <HeroTitle>Your AI</HeroTitle>
          <HeroTitleAccent>Travel Companion</HeroTitleAccent>

          {/* Subtitle */}
          <HeroSubtitle>
            Generate personalised 7-day itineraries, split your budget mathematically, compare local prices, and get live weather alerts — all in one sleek platform.
          </HeroSubtitle>

          {/* CTA Buttons */}
          <HeroButtons>
            <HeroPrimaryBtn
              id="hero-generate-itinerary-btn"
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              ⚡ Generate My Itinerary
            </HeroPrimaryBtn>
            <HeroSecondaryBtn
              id="hero-signin-dashboard-btn"
              onClick={() => handleOpenAuth('login')}
            >
              Sign In to Dashboard →
            </HeroSecondaryBtn>
          </HeroButtons>
        </HeroContent>

        {/* Metrics bar pinned to bottom of hero */}
        <HeroMetricsBar>
          <MetricItem style={{ animationDelay: '0.1s' }}>
            <MetricValue>4,912</MetricValue>
            <MetricLabel>Trips Planned</MetricLabel>
          </MetricItem>

          <MetricItem style={{ animationDelay: '0.2s', position: 'relative' }}>
            <MetricValue>1,248</MetricValue>
            <MetricLabel>Active Users</MetricLabel>
            <ScrollIndicator>
              <ScrollLabel>Scroll to Explore</ScrollLabel>
              <ScrollChevron>
                <ChevronDownIcon />
              </ScrollChevron>
            </ScrollIndicator>
          </MetricItem>

          <MetricItem style={{ animationDelay: '0.3s' }}>
            <MetricValue>98%</MetricValue>
            <MetricLabel>Satisfaction</MetricLabel>
          </MetricItem>

          <MetricItem style={{ animationDelay: '0.4s' }}>
            <MetricValue>28</MetricValue>
            <MetricLabel>Destination Owners</MetricLabel>
          </MetricItem>
        </HeroMetricsBar>
      </HeroContainer>

      {/* ── Three Portals Section ── */}
      <PortalsSection id="portals">
        <PortalsInner>
          <PortalsSectionBadge>
            <PortalsRoleBadge>Choose Your Role</PortalsRoleBadge>
          </PortalsSectionBadge>
          <PortalsSectionTitle>One Platform, Three Portals</PortalsSectionTitle>

          <PortalsGrid>
            {/* Card 1: Traveller */}
            <PortalCard $accent="teal">
              <PortalIconBox $accent="teal">✈️</PortalIconBox>
              <div>
                <PortalCardTitle>Traveller</PortalCardTitle>
              </div>
              <PortalCardDesc>
                AI planner, budget tools, weather &amp; price compare.
              </PortalCardDesc>
              <PortalEnterBtn
                id="portal-traveller-btn"
                $accent="teal"
                onClick={() => {
                  const token = document.cookie.includes('auth_token=');
                  if (token) {
                    router.push('/dashboard');
                  } else {
                    handleOpenAuth('login');
                  }
                }}
              >
                Enter Portal →
              </PortalEnterBtn>
            </PortalCard>

            {/* Card 2: Destination Owner */}
            <PortalCard $accent="teal-active">
              <PortalIconBox $accent="teal-active">🏨</PortalIconBox>
              <div>
                <PortalCardTitle>Destination Owner</PortalCardTitle>
              </div>
              <PortalCardDesc>
                Manage listings, view analytics &amp; traveller traffic.
              </PortalCardDesc>
              <PortalEnterBtn
                id="portal-owner-btn"
                $accent="teal-active"
                onClick={() => {
                  const token = document.cookie.includes('auth_token=');
                  if (token) {
                    router.push('/owner/dashboard');
                  } else {
                    handleOpenAuth('login');
                  }
                }}
              >
                Enter Portal →
              </PortalEnterBtn>
            </PortalCard>

            {/* Card 3: System Admin */}
            <PortalCard $accent="purple">
              <PortalIconBox $accent="purple">🛡️</PortalIconBox>
              <div>
                <PortalCardTitle>System Admin</PortalCardTitle>
              </div>
              <PortalCardDesc>
                Oversee users, monitor APIs, and review feedback.
              </PortalCardDesc>
              <PortalEnterBtn
                id="portal-admin-btn"
                $accent="purple"
                onClick={() => {
                  const token = document.cookie.includes('auth_token=');
                  if (token) {
                    router.push('/admin/dashboard');
                  } else {
                    handleOpenAuth('login');
                  }
                }}
              >
                Enter Portal →
              </PortalEnterBtn>
            </PortalCard>
          </PortalsGrid>
        </PortalsInner>
      </PortalsSection>

      {/* ── Core Features Section ── */}
      <CoreFeaturesSection id="features">
        <CoreFeaturesInner>
          <CoreFeaturesHeader>
            <CoreFeaturesBadge>Core Features</CoreFeaturesBadge>
            <CoreFeaturesTitle>Everything you need to travel smarter</CoreFeaturesTitle>
          </CoreFeaturesHeader>

          <CoreFeaturesGrid>
            {/* Card 1: AI Planner */}
            <FeatureCard>
              <FeatureIconBadge $color="amber">⚡</FeatureIconBadge>
              <div>
                <FeatureCardTitle>AI 7-Day Planner</FeatureCardTitle>
              </div>
              <FeatureCardDesc>
                OpenAI generates a personalised day-by-day itinerary in seconds — activities, timings, and daily budget.
              </FeatureCardDesc>
            </FeatureCard>

            {/* Card 2: Budget Split */}
            <FeatureCard>
              <FeatureIconBadge $color="teal">$</FeatureIconBadge>
              <div>
                <FeatureCardTitle>Smart Budget Split</FeatureCardTitle>
              </div>
              <FeatureCardDesc>
                A mathematical algorithm distributes your total budget across accommodation, food, activities, and transport.
              </FeatureCardDesc>
            </FeatureCard>

            {/* Card 3: Weather Alerts */}
            <FeatureCard>
              <FeatureIconBadge $color="blue">☁</FeatureIconBadge>
              <div>
                <FeatureCardTitle>Live Weather Alerts</FeatureCardTitle>
              </div>
              <FeatureCardDesc>
                Real-time OpenWeatherMap data surfaces storm warnings and sun windows so you plan each day wisely.
              </FeatureCardDesc>
            </FeatureCard>

            {/* Card 4: Price Compare */}
            <FeatureCard>
              <FeatureIconBadge $color="purple">📊</FeatureIconBadge>
              <div>
                <FeatureCardTitle>Price Comparison</FeatureCardTitle>
              </div>
              <FeatureCardDesc>
                Side-by-side local spot ratings, average meal costs, and monthly visitor counts — no guesswork.
              </FeatureCardDesc>
            </FeatureCard>
          </CoreFeaturesGrid>
        </CoreFeaturesInner>
      </CoreFeaturesSection>

      {/* ── How It Works Section ── */}
      <HowItWorksSection id="how-it-works">
        <HowItWorksInner>
          <HowItWorksHeader>
            <HowItWorksBadge>How It Works</HowItWorksBadge>
            <HowItWorksTitle>From idea to itinerary in 30 seconds</HowItWorksTitle>
          </HowItWorksHeader>

          <HowItWorksGrid>
            {/* Step 1 */}
            <HowItWorksStep>
              <StepIconBadge>📍</StepIconBadge>
              <StepNumber>01</StepNumber>
              <HowItWorksStepTitle>Enter destination &amp; budget</HowItWorksStepTitle>
              <HowItWorksStepDesc>
                Type where you want to go and how much you want to spend total.
              </HowItWorksStepDesc>
            </HowItWorksStep>

            {/* Step 2 */}
            <HowItWorksStep>
              <StepIconBadge>⚡</StepIconBadge>
              <StepNumber>02</StepNumber>
              <HowItWorksStepTitle>AI generates your 7-day plan</HowItWorksStepTitle>
              <HowItWorksStepDesc>
                OpenAI crafts a fully timed itinerary with daily activities, costs, and local tips.
              </HowItWorksStepDesc>
            </HowItWorksStep>

            {/* Step 3 */}
            <HowItWorksStep>
              <StepIconBadge>⭐</StepIconBadge>
              <StepNumber>03</StepNumber>
              <HowItWorksStepTitle>Travel with confidence</HowItWorksStepTitle>
              <HowItWorksStepDesc>
                Live weather alerts and price comparisons keep you informed every step of the way.
              </HowItWorksStepDesc>
            </HowItWorksStep>
          </HowItWorksGrid>
        </HowItWorksInner>
      </HowItWorksSection>

      {/* ── User Reviews Section ── */}
      <UserReviewsSection id="reviews">
        <UserReviewsInner>
          <UserReviewsHeader>
            <UserReviewsBadge>USER REVIEWS</UserReviewsBadge>
            <UserReviewsTitle>Travellers love it</UserReviewsTitle>
          </UserReviewsHeader>

          <UserReviewsGrid>
            {/* Card 1: Elena K. */}
            <ReviewCard>
              <RatingStars>★★★★★</RatingStars>
              <ReviewQuote>
                &ldquo;The AI planner nailed every detail of our Prague trip. It even knew which days to schedule lighter so we could recover from jet lag.&rdquo;
              </ReviewQuote>
              <UserMeta>
                <UserAvatar>EK</UserAvatar>
                <UserInfo>
                  <UserName>Elena K.</UserName>
                  <UserRole>Solo Traveller</UserRole>
                </UserInfo>
              </UserMeta>
            </ReviewCard>

            {/* Card 2: Sophie C. */}
            <ReviewCard>
              <RatingStars>★★★★★</RatingStars>
              <ReviewQuote>
                &ldquo;Weather alerts saved us from a storm on day three. The budget split is frighteningly accurate — we came in $12 under.&rdquo;
              </ReviewQuote>
              <UserMeta>
                <UserAvatar>SC</UserAvatar>
                <UserInfo>
                  <UserName>Sophie C.</UserName>
                  <UserRole>Digital Nomad</UserRole>
                </UserInfo>
              </UserMeta>
            </ReviewCard>

            {/* Card 3: James O. */}
            <ReviewCard>
              <RatingStars>★★★★★</RatingStars>
              <ReviewQuote>
                &ldquo;Found restaurants I never would have discovered on my own. The price compare tool is gold for anyone on a tight budget.&rdquo;
              </ReviewQuote>
              <UserMeta>
                <UserAvatar>JO</UserAvatar>
                <UserInfo>
                  <UserName>James O.</UserName>
                  <UserRole>Adventure Seeker</UserRole>
                </UserInfo>
              </UserMeta>
            </ReviewCard>
          </UserReviewsGrid>
        </UserReviewsInner>
      </UserReviewsSection>

      {/* ── Final Call-To-Action Section ── */}
      <FinalCtaSection id="cta">
        <FinalCtaInner>
          <FinalCtaTitle>Ready to plan your trip?</FinalCtaTitle>
          <FinalCtaSubtitle>
            Join 1,200+ travellers who use TravelMate to plan smarter, spend less, and stress never.
          </FinalCtaSubtitle>
          <FinalCtaButton
            id="final-cta-start-btn"
            onClick={() => handleOpenAuth('register')}
          >
            ⚡ Start Planning — It&apos;s Free
          </FinalCtaButton>
        </FinalCtaInner>
      </FinalCtaSection>

      {/* ── Bottom Footer Bar ── */}
      <BottomFooterBar>
        <BottomFooterInner>
          <LogoContainer>
            <TravelMateLogo />
            <LogoText>TravelMate</LogoText>
          </LogoContainer>
          <BottomFooterCopyright>
            &copy; 2026 TravelMate &middot; AI-Powered Travel Planning
          </BottomFooterCopyright>
        </BottomFooterInner>
      </BottomFooterBar>
      {/* Interactive Authentication Modal */}
      {isAuthOpen && (
        <ModalBackdropNew onClick={handleCloseAuth}>
          <ModalCardNew onClick={(e) => e.stopPropagation()}>
            <ModalHeaderNew>
              <LogoContainer>
                <TravelMateLogo />
                <LogoText style={{ fontSize: '1.2rem' }}>TravelMate</LogoText>
              </LogoContainer>
              <ModalCloseBtnNew onClick={handleCloseAuth}>✕</ModalCloseBtnNew>
            </ModalHeaderNew>

            {/* Auth View: Sign In / Create Account */}
            {authView !== 'forgot' && (
              <>
                <TabPillContainer>
                  <TabPillBtn
                    $active={authView === 'login'}
                    onClick={() => { setAuthView('login'); setShowSuccess(false); setErrors({}); }}
                  >
                    Sign In
                  </TabPillBtn>
                  <TabPillBtn
                    $active={authView === 'register'}
                    onClick={() => { setAuthView('register'); setShowSuccess(false); setErrors({}); }}
                  >
                    Create Account
                  </TabPillBtn>
                </TabPillContainer>

                <RoleLabel>SIGN IN AS</RoleLabel>
                <RoleGrid>
                  <RoleCardBtn
                    $selected={selectedRole === 'traveller'}
                    onClick={() => setSelectedRole('traveller')}
                  >
                    <RoleIcon>✈️</RoleIcon>
                    <RoleName>Traveller</RoleName>
                  </RoleCardBtn>
                  <RoleCardBtn
                    $selected={selectedRole === 'destination'}
                    onClick={() => setSelectedRole('destination')}
                  >
                    <RoleIcon>🏨</RoleIcon>
                    <RoleName>Destination</RoleName>
                  </RoleCardBtn>
                  <RoleCardBtn
                    $selected={selectedRole === 'system'}
                    onClick={() => setSelectedRole('system')}
                  >
                    <RoleIcon>🛡️</RoleIcon>
                    <RoleName>System</RoleName>
                  </RoleCardBtn>
                </RoleGrid>

                {showSuccess ? (
                  <SuccessPanel>
                    <SuccessIcon>✓</SuccessIcon>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#10b981', fontWeight: 800 }}>Welcome!</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{successMsg}</p>
                    </div>
                  </SuccessPanel>
                ) : authView === 'login' ? (
                  <form onSubmit={handleLoginSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <FormLabelNew htmlFor="modal-login-email">Email</FormLabelNew>
                      <FormInputNew
                        id="modal-login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                      {errors.loginEmail && <ErrorMsg>{errors.loginEmail}</ErrorMsg>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <FormLabelNew htmlFor="modal-login-pass" style={{ margin: 0 }}>Password</FormLabelNew>
                        <a
                          onClick={() => { setAuthView('forgot'); setShowSuccess(false); setErrors({}); }}
                          style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Forgot password?
                        </a>
                      </div>
                      <FormInputNew
                        id="modal-login-pass"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                      {errors.loginPassword && <ErrorMsg>{errors.loginPassword}</ErrorMsg>}
                    </div>

                    <PrimarySubmitBtnNew type="submit">Sign In</PrimarySubmitBtnNew>

                    <BottomSwitchText>
                      Don&apos;t have an account?
                      <span onClick={() => { setAuthView('register'); setShowSuccess(false); setErrors({}); }}>
                        Sign up free
                      </span>
                    </BottomSwitchText>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <FormLabelNew htmlFor="modal-reg-email">Email</FormLabelNew>
                      <FormInputNew
                        id="modal-reg-email"
                        type="email"
                        placeholder="you@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                      />
                      {errors.regEmail && <ErrorMsg>{errors.regEmail}</ErrorMsg>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <FormLabelNew htmlFor="modal-reg-pass">Password</FormLabelNew>
                      <FormInputNew
                        id="modal-reg-pass"
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                      {errors.regPassword && <ErrorMsg>{errors.regPassword}</ErrorMsg>}
                    </div>

                    <PrimarySubmitBtnNew type="submit">Create Account</PrimarySubmitBtnNew>

                    <BottomSwitchText>
                      Already have an account?
                      <span onClick={() => { setAuthView('login'); setShowSuccess(false); setErrors({}); }}>
                        Sign in
                      </span>
                    </BottomSwitchText>
                  </form>
                )}
              </>
            )}

            {/* Auth View: Forgot Password */}
            {authView === 'forgot' && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px 0' }}>Reset Password</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px 0' }}>
                  Enter your account email to receive a password reset link.
                </p>

                {showSuccess ? (
                  <SuccessPanel>
                    <SuccessIcon>🛡️</SuccessIcon>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#f59e0b', fontWeight: 800 }}>Link Sent</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{successMsg}</p>
                    </div>
                    <PrimarySubmitBtnNew onClick={() => { setAuthView('login'); setShowSuccess(false); }} style={{ marginTop: '16px' }}>
                      Back to Sign In
                    </PrimarySubmitBtnNew>
                  </SuccessPanel>
                ) : (
                  <form onSubmit={handleForgotSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <FormLabelNew htmlFor="modal-forgot-email">Email Address</FormLabelNew>
                      <FormInputNew
                        id="modal-forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                      />
                      {errors.forgotEmail && <ErrorMsg>{errors.forgotEmail}</ErrorMsg>}
                    </div>

                    <PrimarySubmitBtnNew type="submit">Send Recovery Email</PrimarySubmitBtnNew>

                    <BottomSwitchText>
                      Remembered?
                      <span onClick={() => { setAuthView('login'); setShowSuccess(false); setErrors({}); }}>
                        Sign in
                      </span>
                    </BottomSwitchText>
                  </form>
                )}
              </div>
            )}
          </ModalCardNew>
        </ModalBackdropNew>
      )}
    </PageContainer>
  );
}
