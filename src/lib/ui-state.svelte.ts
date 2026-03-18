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
		if (!this.zenMode) {
			// Snapshot and collapse panels optimistically.
			this.preZenPanelsState = {
				tocOpen: this.tocOpen,
				settingsOpen: this.settingsOpen,
				sidebarOpen: this.sidebarOpen,
			};
			this.tocOpen = false;
			this.settingsOpen = false;
			this.sidebarOpen = false;

			// Request fullscreen — zenMode will be set to true only if it succeeds
			// via the fullscreenchange event handler.
			document.documentElement.requestFullscreen().catch(() => {
				// Fullscreen was denied — roll back panel state.
				this.tocOpen = this.preZenPanelsState.tocOpen;
				this.settingsOpen = this.preZenPanelsState.settingsOpen;
				this.sidebarOpen = this.preZenPanelsState.sidebarOpen;
			});
		} else {
			// exitFullscreen triggers fullscreenchange, which sets zenMode = false
			// and restores panels. Nothing else needed here.
			document.exitFullscreen();
		}
	};

	handleFullscreenChange = () => {
		const isFullscreen = !!document.fullscreenElement;

		if (isFullscreen && !this.zenMode) {
			// Fullscreen became active (our request succeeded).
			this.zenMode = true;
		} else if (!isFullscreen && this.zenMode) {
			// Fullscreen ended — whether via our button, Esc, browser UI, or OS.
			this.zenMode = false;
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
