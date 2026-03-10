import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LibraryView from './views/LibraryView';
import RecorderView from './views/RecorderView';
import EditorView from './views/EditorView';
import AnalysisView from './views/AnalysisView';
import SettingsView from './views/SettingsView';
import StorageQuotaModal from './components/StorageQuotaModal';
import { View, Note, AppSettings } from './types';
import { initDB, getAllNotes, saveNote, deleteNote, getSettings, saveSettings, migrateFromLocalStorage, deleteNotesBefore, clearAllNotes } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.LIBRARY);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  
  // Settings State
  const [settings, setSettingsState] = useState<AppSettings>({
      darkMode: true,
      compactMode: false,
      defaultNoteFormat: 'Structured',
      autoGenerateTitles: true,
      themeColor: '#c4f20d' // Default Lime
  });

  const [notes, setNotesState] = useState<Note[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshNotes = async () => {
      const storedNotes = await getAllNotes();
      setNotesState(storedNotes);
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
        try {
            await initDB();
            await migrateFromLocalStorage();

            const storedSettings = await getSettings();
            if (storedSettings) {
                setSettingsState(storedSettings);
            }

            const storedNotes = await getAllNotes();
            if (storedNotes.length > 0) {
                setNotesState(storedNotes);
            } else {
                // Initialize with welcome note if empty
                const welcomeNote: Note = {
                    id: '1',
                    title: 'Welcome to Modular AI',
                    date: new Date().toLocaleDateString(),
                    content: `<h1>Welcome!</h1><p>This is your first note. You can edit this, or create new ones by recording audio or uploading documents.</p><ul><li>Try the <b>Active Record</b> feature to transcribe live audio.</li><li>Upload a PDF or Image in the <b>Library</b>.</li><li>Use the <b>Global Analysis</b> to chat with all your notes at once.</li></ul>`,
                    transcript: `Welcome! This is your first note. You can edit this, or create new ones by recording audio or uploading documents. Try the Active Record feature to transcribe live audio. Upload a PDF or Image in the Library. Use the Global Analysis to chat with all your notes at once.`,
                    type: 'TEXT',
                    tags: ['Welcome', 'Guide'],
                    lastAccessed: new Date().toISOString()
                };
                await saveNote(welcomeNote);
                setNotesState([welcomeNote]);
            }
            setIsLoaded(true);
        } catch (error) {
            console.error("Failed to initialize app data:", error);
            // Fallback to loaded state so UI shows something even if DB fails
            setIsLoaded(true);
        }
    };
    loadData();
  }, []);

  // Wrapper to update settings state and DB
  const setSettings = (newSettings: AppSettings | ((prev: AppSettings) => AppSettings)) => {
      setSettingsState(prev => {
          const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
          saveSettings(updated).catch(err => console.error("Failed to save settings:", err));
          return updated;
      });
  };

  // Apply Theme Effect (Dark Mode)
  useEffect(() => {
    if (settings.darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Helper to convert hex to rgb for CSS vars
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '196 242 13';
  }

  const handleOpenNote = (note: Note) => {
    // Update last accessed
    const updatedNote = { ...note, lastAccessed: new Date().toISOString() };
    handleSaveNote(updatedNote);
    setActiveNote(updatedNote);
    setCurrentView(View.EDITOR);
  };

  const handleSaveNote = (updatedNote: Note) => {
    setNotesState(prev => {
        const exists = prev.find(n => n.id === updatedNote.id);
        let newNotes;
        if (exists) {
            newNotes = prev.map(n => n.id === updatedNote.id ? updatedNote : n);
        } else {
            newNotes = [updatedNote, ...prev];
        }
        return newNotes;
    });
    
    // Save to DB
    saveNote(updatedNote).catch(err => {
        console.error("Failed to save note:", err);
        // Check for quota exceeded error
        if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.message?.includes('quota'))) {
            setShowQuotaModal(true);
        }
    });

    // If this was the active note, update it too to reflect changes immediately
    if (activeNote?.id === updatedNote.id) {
        setActiveNote(updatedNote);
    }
  };

  const handleToggleBookmark = (note: Note) => {
      handleSaveNote({ ...note, isBookmarked: !note.isBookmarked });
  };

  const handleDeleteNote = (noteId: string) => {
      setNotesState(prev => prev.filter(n => n.id !== noteId));
      deleteNote(noteId).catch(err => console.error("Failed to delete note:", err));
      
      if (activeNote?.id === noteId) {
          setActiveNote(null);
          setCurrentView(View.LIBRARY);
      }
  };

  const handleClearData = async () => {
      await clearAllNotes();
      setNotesState([]);
      setActiveNote(null);
  };

  const handleClearOldNotes = async () => {
      // Clear notes older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      try {
          await deleteNotesBefore(thirtyDaysAgo);
          await refreshNotes();
          setShowQuotaModal(false);
      } catch (e) {
          console.error("Failed to clear old notes:", e);
      }
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case View.LIBRARY:
        return (
            <LibraryView 
                notes={notes}
                onOpenNote={handleOpenNote} 
                onNavigate={handleNavigate}
                onImport={(note) => {
                    handleSaveNote(note);
                    handleOpenNote(note);
                }}
                onDeleteNote={handleDeleteNote}
                compactMode={settings.compactMode}
            />
        );
      case View.BOOKMARKS:
        return (
             <LibraryView 
                notes={notes}
                onOpenNote={handleOpenNote} 
                onNavigate={handleNavigate}
                onImport={() => {}}
                onDeleteNote={handleDeleteNote}
                filterView={View.BOOKMARKS}
                compactMode={settings.compactMode}
            />
        );
      case View.HISTORY:
        return (
             <LibraryView 
                notes={notes}
                onOpenNote={handleOpenNote} 
                onNavigate={handleNavigate}
                onImport={() => {}}
                onDeleteNote={handleDeleteNote}
                filterView={View.HISTORY}
                compactMode={settings.compactMode}
            />
        );
      case View.ANALYSIS:
         return <AnalysisView notes={notes} />;
      case View.RECORDER:
        return (
            <RecorderView 
                onSaveSession={(note) => {
                    handleSaveNote(note);
                    handleOpenNote(note);
                }}
                onCancel={() => setCurrentView(View.LIBRARY)}
                autoGenerateTitles={settings.autoGenerateTitles}
            />
        );
      case View.EDITOR:
        return activeNote ? (
            <EditorView 
                note={activeNote} 
                onBack={() => setCurrentView(View.LIBRARY)}
                onUpdate={handleSaveNote}
                onToggleBookmark={handleToggleBookmark}
            />
        ) : <LibraryView notes={notes} onOpenNote={handleOpenNote} onNavigate={handleNavigate} onImport={() => {}} onDeleteNote={handleDeleteNote} />;
      case View.SETTINGS:
        return (
            <SettingsView 
                settings={settings} 
                onUpdateSettings={setSettings}
                onClearData={handleClearData}
            />
        );
      default:
        return <LibraryView notes={notes} onOpenNote={handleOpenNote} onNavigate={handleNavigate} onImport={() => {}} onDeleteNote={handleDeleteNote} />;
    }
  };

  if (!isLoaded) return null;

  return (
    <div 
        className="bg-[#f4f4f5] dark:bg-[#09090b] text-slate-900 dark:text-white font-display overflow-hidden h-screen flex selection:bg-[var(--theme-color)] selection:text-black"
        style={{ 
            "--theme-color": settings.themeColor, 
            "--theme-rgb": hexToRgb(settings.themeColor) 
        } as React.CSSProperties}
    >
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      {renderView()}
      
      <StorageQuotaModal 
        isOpen={showQuotaModal} 
        onClose={() => setShowQuotaModal(false)}
        onClearOldNotes={handleClearOldNotes}
        onClearAllNotes={async () => {
            await handleClearData();
            setShowQuotaModal(false);
        }}
      />
    </div>
  );
};

export default App;