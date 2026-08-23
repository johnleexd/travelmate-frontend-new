'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/navigation';

const colors = {
  primary: '#1a73e8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  textMain: '#0f172a',
  textSecondary: '#64748b',
  bgGlass: 'rgba(255, 255, 255, 0.85)',
  borderGlass: 'rgba(255, 255, 255, 0.5)',
};

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  background: 
    linear-gradient(180deg, rgba(15, 23, 42, 0.15) 0%, rgba(15, 23, 42, 0.35) 100%),
    url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=80') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
  padding: 24px;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: ${colors.textMain};
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.header`
  background: ${colors.bgGlass};
  backdrop-filter: blur(12px);
  border: 1px solid ${colors.borderGlass};
  border-radius: 16px;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
`;

const LogoText = styled.span`
  font-size: 1.25rem;
  font-weight: 800;
  color: #1e293b;
  span {
    color: #1a73e8;
  }
`;

const Badge = styled.span`
  background: #fef2f2;
  color: #ef4444;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
`;

const StatCard = styled.div`
  background: ${colors.bgGlass};
  backdrop-filter: blur(12px);
  border: 1px solid ${colors.borderGlass};
  border-radius: 12px;
  padding: 20px;
  text-align: center;
`;

const StatVal = styled.div`
  font-size: 1.8rem;
  font-weight: 800;
  color: #1a73e8;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  margin-top: 4px;
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: ${colors.bgGlass};
  backdrop-filter: blur(12px);
  border: 1px solid ${colors.borderGlass};
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
`;

const CardTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0 0 16px 0;
  border-bottom: 1.5px solid rgba(0,0,0,0.05);
  padding-bottom: 8px;
`;

const QueueItem = styled.div`
  padding: 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255,255,255,0.8);
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const QueueDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const QueueTitle = styled.span`
  font-weight: 700;
  font-size: 0.9rem;
`;

const QueueDesc = styled.span`
  font-size: 0.8rem;
  color: #64748b;
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionBtn = styled.button<{ variant?: 'success' | 'danger' }>`
  background: ${props => props.variant === 'danger' ? colors.danger : colors.success};
  color: #white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  color: white;
  transition: opacity 0.2s ease;
  &:hover {
    opacity: 0.9;
  }
`;

const LogoutBtn = styled.button`
  background: transparent;
  border: 1.5px solid #cbd5e1;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.2);
  }
`;

export default function AdminDashboard() {
  const router = useRouter();

  // Verification and Dispute queue items based on Trust score logic and Host Path moderation checks
  const [verifications, setVerifications] = useState([
    { id: 'V-101', name: 'John Doe', type: 'Traveler Profile', details: 'Awaiting ID validation' },
    { id: 'V-102', name: 'Beach Paradise Villa', type: 'Host Listing', details: 'Check slot capacity limit: 5' }
  ]);

  const [disputes, setDisputes] = useState([
    { id: 'D-501', traveler: 'Jane Smith', host: 'Resort owner', issue: 'Cancellation Modification Dispute' }
  ]);

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/');
  };

  const handleApprove = (id: string) => {
    setVerifications(prev => prev.filter(item => item.id !== id));
  };

  const handleResolve = (id: string) => {
    setDisputes(prev => prev.filter(item => item.id !== id));
  };

  return (
    <Container>
      <ContentWrapper>
        <Header>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <LogoText>Travel<span>Admin</span></LogoText>
            <Badge style={{ marginLeft: 12 }}>System Control Room</Badge>
          </div>
          <LogoutBtn onClick={handleLogout}>Sign Out</LogoutBtn>
        </Header>

        {/* System Stats */}
        <StatsGrid>
          <StatCard>
            <StatVal>1,240</StatVal>
            <StatLabel>Verified Travelers</StatLabel>
          </StatCard>
          <StatCard>
            <StatVal>180</StatVal>
            <StatLabel>Registered Hosts</StatLabel>
          </StatCard>
          <StatCard>
            <StatVal>₱1.2M</StatVal>
            <StatLabel>Total Escrow volume</StatLabel>
          </StatCard>
        </StatsGrid>

        <MainGrid>
          {/* Verification Moderation Queue */}
          <Card>
            <CardTitle>Account Verification moderation Queue</CardTitle>
            {verifications.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: colors.textSecondary }}>No pending verifications.</span>
            ) : (
              verifications.map((item) => (
                <QueueItem key={item.id}>
                  <QueueDetails>
                    <QueueTitle>{item.name} ({item.type})</QueueTitle>
                    <QueueDesc>{item.details}</QueueDesc>
                  </QueueDetails>
                  <ActionGroup>
                    <ActionBtn onClick={() => handleApprove(item.id)}>Approve</ActionBtn>
                    <ActionBtn variant="danger" onClick={() => handleApprove(item.id)}>Reject</ActionBtn>
                  </ActionGroup>
                </QueueItem>
              ))
            )}
          </Card>

          {/* Admin Dispute Resolution Queue */}
          <Card>
            <CardTitle>Admin Dispute Resolution Queue</CardTitle>
            {disputes.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: colors.textSecondary }}>No active disputes.</span>
            ) : (
              disputes.map((item) => (
                <QueueItem key={item.id}>
                  <QueueDetails>
                    <QueueTitle>Dispute #{item.id}: {item.traveler} vs {item.host}</QueueTitle>
                    <QueueDesc>{item.issue}</QueueDesc>
                  </QueueDetails>
                  <ActionGroup>
                    <ActionBtn onClick={() => handleResolve(item.id)}>Rule Traveler</ActionBtn>
                    <ActionBtn variant="danger" onClick={() => handleResolve(item.id)}>Rule Host</ActionBtn>
                  </ActionGroup>
                </QueueItem>
              ))
            )}
          </Card>
        </MainGrid>
      </ContentWrapper>
    </Container>
  );
}
