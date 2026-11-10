import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { DirectoryLayout } from './layouts/Directory';
import { InspectorLayout } from './layouts/Inspector';
import { DesktopLayout } from './layouts/Desktop';
import { HorizontalLayout } from './layouts/Horizontal';
import { FocusLayout } from './layouts/Focus';

const layouts = [DirectoryLayout, InspectorLayout, DesktopLayout, HorizontalLayout, FocusLayout];
const index = Number(new URLSearchParams(window.location.search).get('layout') || '1') - 1;
const Layout = layouts[index] || DirectoryLayout;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Layout/></React.StrictMode>);
