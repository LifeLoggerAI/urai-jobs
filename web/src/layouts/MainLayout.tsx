import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="main-layout">
      {/* A common header or nav could go here */}
      <main>{children}</main>
      {/* A common footer could go here */}
    </div>
  );
};

export default MainLayout;
