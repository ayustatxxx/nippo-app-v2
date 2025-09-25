// App.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import GroupListPage from './pages/GroupListPage';
import PostPage from './group/PostPage';
import ArchivePage from './group/ArchivePage';
import GroupTopPage from './group/GroupTopPage';
import GroupMembersPage from './group/GroupMembersPage';
import PostDetailPage from './pages/PostDetailPage';
import EditPostPage from './pages/EditPostPage'; 
import InvitePage from './pages/InvitePage';


function App() {
  return (
    <Routes>
      {/* ログインページ */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* 認証が必要なページをAuthGuardで保護 */}
      <Route path="/" element={
        <AuthGuard>
          <HomePage />
        </AuthGuard>
      } />

　　　 <Route path="/invite/:groupId/:inviteToken" element={
  <AuthGuard>
    <InvitePage />
  </AuthGuard>
} />
      
      <Route path="/profile" element={
        <AuthGuard>
          <ProfilePage />
        </AuthGuard>
      } />
      
      <Route path="/groups" element={
        <AuthGuard>
          <GroupListPage />
        </AuthGuard>
      } />
      
      <Route path="/post/:postId" element={
        <AuthGuard>
          <PostDetailPage />
        </AuthGuard>
      } />
      
      <Route path="/edit-post/:postId" element={
        <AuthGuard>
          <EditPostPage />
        </AuthGuard>
      } />

      {/* グループ関連のルート */}
      <Route path="/group/:groupId" element={
        <AuthGuard>
          <GroupTopPage />
        </AuthGuard>
      } />
      
      <Route path="/group/:groupId/post" element={
        <AuthGuard>
          <PostPage />
        </AuthGuard>
      } />
      
      <Route path="/group/:groupId/archive" element={
        <AuthGuard>
          <ArchivePage />
        </AuthGuard>
      } />
      
      <Route path="/group/:groupId/members" element={
        <AuthGuard>
          <GroupMembersPage />
        </AuthGuard>
      } />
      
      
    </Routes>
  );
}

export default App;