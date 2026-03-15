export class UiState {
	theme: 'light' | 'dark' = $state('light');

	sidebarOpen = $state(false);
	tocOpen = $state(false);
	settingsOpen = $state(false);
	backupOpen = $state(false);
	versionsOpen = $state(false);
	zenMode = $state(false);
	scrollToIndex: number | null = $state(null);

	private preZenPanelsState = {
		tocOpen: false,
		settingsOpen: false,
		sidebarOpen: false,
	};

	initTheme = () => {
		if (typeof window === 'undefined') return;

		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || savedTheme === 'light') {
			this.theme = savedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.theme = 'dark';
		}
		this.applyTheme();
	};

	toggleTheme = () => {
		this.theme = this.theme === 'light' ? 'dark' : 'light';
		localStorage.setItem('theme', this.theme);
		this.applyTheme();
	};

	toggleZenMode = () => {
		this.zenMode = !this.zenMode;
		if (this.zenMode) {
			this.preZenPanelsState = {
				tocOpen: this.tocOpen,
				settingsOpen: this.settingsOpen,
				sidebarOpen: this.sidebarOpen,
			};
			this.tocOpen = false;
			this.settingsOpen = false;
			this.sidebarOpen = false;
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
			this.tocOpen = this.preZenPanelsState.tocOpen;
			this.settingsOpen = this.preZenPanelsState.settingsOpen;
			this.sidebarOpen = this.preZenPanelsState.sidebarOpen;
		}
	};

	private applyTheme = () => {
		if (typeof document !== 'undefined') {
			if (this.theme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	};
}

export const uiState = new UiState();
