import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type CategoryOption = {
  id: number;
  label: string;
  sub: string;
  icon: string;
  className: string;
};

type Resource = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state?: string | null;
  zip_code: string;
  phone_number: string | null;
  hours_of_operation?: string | null;
  website?: string | null;
  requirements?: string | null;
  is_verified?: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  category_name: string | null;
};

type ResourceTag = {
  label: string;
  className: string;
};

type SubmissionForm = {
  zipOrCity: string;
  categoryId: number | null;
  notes: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isEmailVerified?: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  details: string;
  category: 'food' | 'health' | 'housing' | 'jobs' | 'legal' | 'government';
  dateLabel: string;
  isUnread: boolean;
};

type ApiNotificationRow = {
  notification_id: string;
  action: 'created' | 'updated' | 'verified' | 'deleted' | string;
  created_at: string;
  resource_id: string;
  resource_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  category_name: string | null;
};

type FlaggedResourceItem = {
  id: string;
  resource: Resource;
  reason: string;
  flaggedAt: string;
  flaggedDateLabel: string;
};

type UpdateRequestStatus = 'pending' | 'reviewed' | 'declined';

type UpdateRequestItem = {
  id: string;
  resource: Resource;
  note: string;
  submittedAt: string;
  submittedDateLabel: string;
  status: UpdateRequestStatus;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiBaseUrl = 'http://localhost:8080/api';
  private readonly guestSavedResourcesKey = 'crf_saved_resources_local_guest';
  private readonly guestRecentSearchesKey = 'crf_recent_searches_guest';
  private readonly guestFlaggedResourcesKey = 'crf_flagged_resources_guest';
  private readonly guestUpdateRequestsKey = 'crf_update_requests_guest';

  readonly title = 'Community Resource Finder';
  searchInput = '';
  isLoading = false;
  isOffline = false;
  errorMessage = '';
  submissionError = '';
  submissionSuccess = '';
  showRecentsPanel = false;
  recentSearches: string[] = [];
  isRequestingLocation = false;
  locationStatusMessage = '';
  userLocation: { lat: number; lng: number } | null = null;
  hasSearched = false;
  selectedCategoryId: number | null = null;
  selectedCategoryLabel = '';
  viewMode: 'landing' | 'categoryResults' | 'savedResources' | 'login' | 'forgotPassword' | 'register' | 'userDashboard' = 'landing';
  expandedResourceId: string | null = null;
  lastSearchTerm = '';
  resolvedCityName = '';
  allResults: Resource[] = [];
  filteredResults: Resource[] = [];
  savedResources: Resource[] = [];
  currentUser: AuthUser | null = null;
  dashboardTab: 'dashboard' | 'notifications' | 'saved' | 'flagged' | 'updateRequests' | 'settings' = 'dashboard';
  authToken = '';
  authMessage = '';
  isSyncingSaved = false;
  flaggingResourceId: string | null = null;
  expandedFlaggedResourceId: string | null = null;
  flagReason = '';
  flagError = '';
  flagSuccess = '';
  flaggedResources: FlaggedResourceItem[] = [];
  updateRequests: UpdateRequestItem[] = [];
  settingsFirstName = '';
  settingsLastName = '';
  settingsEmail = '';
  settingsCurrentPassword = '';
  showSettingsCurrentPassword = false;
  settingsNewPassword = '';
  showSettingsNewPassword = false;
  settingsError = '';
  settingsSuccess = '';
  showDeleteModal = false;
  deletePassword = '';
  showDeletePassword = false;
  deleteError = '';
  updateRequestZip = '';
  updateRequestNote = '';
  updateRequestError = '';
  updateRequestSuccess = '';
  showSuggestionForm = false;
  isSubmittingSuggestion = false;
  loginEmail = '';
  loginPassword = '';
  showLoginPassword = false;
  loginRole: 'user' | 'admin' = 'user';
  loginError = '';
  loginSuccess = '';
  isLoggingIn = false;
  forgotPasswordEmail = '';
  forgotPasswordError = '';
  forgotPasswordSuccess = '';
  isSendingResetLink = false;
  registerFirstName = '';
  registerLastName = '';
  registerEmail = '';
  registerRole: 'user' | 'admin' = 'user';
  registerPassword = '';
  showRegisterPassword = false;
  registerConfirmPassword = '';
  showRegisterConfirmPassword = false;
  registerError = '';
  registerSuccess = '';
  isRegistering = false;
  suggestionForm: SubmissionForm = {
    zipOrCity: '',
    categoryId: null,
    notes: '',
  };
  dashboardNotifications: NotificationItem[] = [];

  readonly categories = [
    { id: 1, label: 'Food', sub: 'Pantries & meals', icon: '🍎', className: 'card-food' },
    { id: 2, label: 'Health', sub: 'Clinics & care', icon: '🏥', className: 'card-health' },
    { id: 3, label: 'Jobs', sub: 'Training & work', icon: '💼', className: 'card-jobs' },
    { id: 4, label: 'Housing', sub: 'Shelter & rentals', icon: '🏠', className: 'card-housing' },
    { id: 5, label: 'Legal', sub: 'Aid & rights', icon: '⚖️', className: 'card-legal' },
    { id: 6, label: 'Government', sub: 'Benefits & programs', icon: '🏛️', className: 'card-govt' },
  ] satisfies CategoryOption[];

  private readonly onOfflineHandler = () => {
    this.isOffline = true;
  };

  private readonly onOnlineHandler = () => {
    this.isOffline = false;
  };

  ngOnInit(): void {
    this.loadAuthSession();
    this.loadSavedResources();
    this.loadFlaggedResources();
    this.loadUpdateRequests();
    this.refreshRecentSearches();
    this.isOffline = !navigator.onLine;
    window.addEventListener('offline', this.onOfflineHandler);
    window.addEventListener('online', this.onOnlineHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.onOfflineHandler);
    window.removeEventListener('online', this.onOnlineHandler);
  }

  searchByZip(): void {
    const term = this.searchInput.trim();
    if (!term) {
      this.errorMessage = 'Please enter a ZIP code or city name first.';
      return;
    }

    const keepCategoryView = this.viewMode === 'categoryResults' && this.selectedCategoryId !== null;
    const activeCategoryId = this.selectedCategoryId;
    const activeCategoryLabel = this.selectedCategoryLabel;

    this.errorMessage = '';
    this.submissionError = '';
    this.submissionSuccess = '';
    this.showRecentsPanel = false;
    this.isLoading = true;
    this.hasSearched = true;
    this.lastSearchTerm = term;
    if (!keepCategoryView) {
      this.selectedCategoryId = null;
      this.selectedCategoryLabel = '';
      this.viewMode = 'landing';
    }
    this.filteredResults = [];
    this.allResults = [];

    const isZip = /^\d{5}$/.test(term);
    let params = new HttpParams();

    if (isZip) {
      params = params.set('zip', term);
    } else {
      params = params.set('city', term);
    }

    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/resources/search`, { params })
      .subscribe({
        next: (rows) => {
          this.allResults = rows;
          this.resolvedCityName = this.pickCityName(rows, term);
          this.isLoading = false;
          this.saveRecentSearch(term);
          if (rows.length > 0) {
            this.showSuggestionForm = false;
          }

          if (keepCategoryView && activeCategoryId !== null) {
            this.selectedCategoryId = activeCategoryId;
            this.selectedCategoryLabel = activeCategoryLabel;
            this.filteredResults = rows.filter((item) => {
              const itemCategory = (item.category_name || '').toLowerCase();
              return itemCategory === activeCategoryLabel.toLowerCase();
            });
            this.viewMode = 'categoryResults';
          }
        },
        error: () => {
          this.errorMessage = 'Could not load resources. Make sure backend is running on port 8080.';
          this.isLoading = false;
        },
      });
  }

  openRecents(): void {
    this.refreshRecentSearches();
    this.showRecentsPanel = !this.showRecentsPanel;
  }

  requestCurrentLocation(): void {
    this.locationStatusMessage = '';
    if (!('geolocation' in navigator)) {
      this.locationStatusMessage = 'Geolocation is not supported on this device.';
      return;
    }

    this.isRequestingLocation = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.isRequestingLocation = false;
        this.locationStatusMessage = 'Using your current location for distance estimates.';
      },
      () => {
        this.isRequestingLocation = false;
        this.locationStatusMessage = 'Could not access your location. You can still search by ZIP/city.';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  clearCurrentLocation(): void {
    this.userLocation = null;
    this.locationStatusMessage = 'Location disabled. Distances are hidden.';
  }

  useRecentSearch(term: string): void {
    this.searchInput = term;
    this.showRecentsPanel = false;
    this.searchByZip();
  }

  openSavedResources(): void {
    this.loadSavedResources();
    this.viewMode = 'savedResources';
  }

  openCategory(category: string, categoryId: number): void {
    this.errorMessage = '';
    this.selectedCategoryId = categoryId;
    this.selectedCategoryLabel = category;
    this.expandedResourceId = null;
    this.filteredResults = this.allResults.length
      ? this.allResults.filter((item) => {
          const itemCategory = (item.category_name || '').toLowerCase();
          return itemCategory === category.toLowerCase();
        })
      : [];
    this.viewMode = 'categoryResults';
    if (!this.suggestionForm.categoryId) {
      this.suggestionForm.categoryId = categoryId;
    }
  }

  openCreateAccount(): void {
    this.viewMode = 'register';
    this.registerError = '';
    this.registerSuccess = '';
    this.registerEmail = this.loginEmail.trim();
  }

  openLogin(): void {
    this.viewMode = 'login';
    this.loginError = '';
    this.loginSuccess = '';
  }

  openUserDashboard(): void {
    if (!this.currentUser) {
      this.openLogin();
      return;
    }
    this.authMessage = '';
    this.dashboardTab = 'dashboard';
    this.viewMode = 'userDashboard';
  }

  getDashboardUserName(): string {
    const candidate = this.currentUser?.name?.trim();
    if (candidate) return candidate;
    const email = this.currentUser?.email || '';
    return email.includes('@') ? email.split('@')[0] : 'User';
  }

  getDashboardUserInitials(): string {
    const name = this.getDashboardUserName();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  getDashboardUserSubLabel(): string {
    return this.currentUser?.role === 'admin' ? 'Admin' : 'Member';
  }

  runDashboardSearch(): void {
    const term = this.searchInput.trim();
    if (!term) {
      this.authMessage = 'Enter a ZIP code or city first.';
      return;
    }

    let params = new HttpParams();
    if (/^\d{5}$/.test(term)) {
      params = params.set('zip', term);
    } else {
      params = params.set('city', term);
    }

    this.isLoading = true;
    this.authMessage = '';
    this.selectedCategoryId = null;
    this.selectedCategoryLabel = '';
    this.filteredResults = [];
    this.expandedResourceId = null;
    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/resources/search`, { params })
      .subscribe({
        next: (rows) => {
          this.allResults = rows;
          this.filteredResults = [];
          this.hasSearched = true;
          this.lastSearchTerm = term;
          this.resolvedCityName = this.pickCityName(rows, term);
          this.saveRecentSearch(term);
          this.isLoading = false;
          this.authMessage = rows.length
            ? `Loaded ${rows.length} resources. Pick a category below.`
            : 'No resources found for that area yet.';
        },
        error: () => {
          this.isLoading = false;
          this.authMessage = 'Could not load resources right now. Please try again.';
        },
      });
  }

  openDashboardCategory(category: string, categoryId: number): void {
    if (!this.hasSearched) {
      this.authMessage = 'Search by ZIP/city first, then pick a category.';
      return;
    }
    this.selectedCategoryId = categoryId;
    this.selectedCategoryLabel = category;
    this.expandedResourceId = null;
    this.filteredResults = this.allResults.filter((item) => {
      const itemCategory = (item.category_name || '').toLowerCase();
      return itemCategory === category.toLowerCase();
    });
    this.authMessage = this.filteredResults.length
      ? `${this.filteredResults.length} ${category.toLowerCase()} resources loaded.`
      : `No ${category.toLowerCase()} resources found for this area.`;
  }

  openDashboardNotifications(): void {
    this.dashboardTab = 'notifications';
    this.authMessage = '';
    this.loadDashboardNotifications();
  }

  openDashboardFlaggedResources(): void {
    this.dashboardTab = 'flagged';
    this.authMessage = '';
  }

  openDashboardAccountSettings(): void {
    this.dashboardTab = 'settings';
    this.authMessage = '';
    this.settingsError = '';
    this.settingsSuccess = '';
    this.deleteError = '';
    this.initializeSettingsFormFromCurrentUser();
  }

  openDashboardUpdateRequests(): void {
    this.dashboardTab = 'updateRequests';
    this.authMessage = '';
    this.updateRequestError = '';
    this.updateRequestSuccess = '';
  }

  openDashboardMain(): void {
    this.dashboardTab = 'dashboard';
  }

  openDashboardSavedResources(): void {
    this.dashboardTab = 'saved';
    this.authMessage = '';
  }

  viewSavedResource(resourceId: string): void {
    this.expandedResourceId = this.expandedResourceId === resourceId ? null : resourceId;
  }

  getSavedResourceIcon(resource: Resource): string {
    const category = (resource.category_name || '').toLowerCase();
    const iconMap: Record<string, string> = {
      food: '🍎',
      health: '🏥',
      housing: '🏠',
      jobs: '💼',
      legal: '⚖️',
      government: '🏛️',
    };
    return iconMap[category] || '📍';
  }

  getSavedResourceIconBackground(resource: Resource): string {
    const category = (resource.category_name || '').toLowerCase();
    const colorMap: Record<string, string> = {
      food: '#FAEEDA',
      health: '#FCEBEB',
      housing: '#EEEDFE',
      jobs: '#E6F1FB',
      legal: '#EAF3DE',
      government: '#FAECE7',
    };
    return colorMap[category] || '#E1F5EE';
  }

  get unreadNotificationCount(): number {
    return this.dashboardNotifications.filter((item) => item.isUnread).length;
  }

  saveAccountSettings(): void {
    this.settingsError = '';
    this.settingsSuccess = '';

    const email = this.settingsEmail.trim().toLowerCase();

    if (!email) {
      this.settingsError = 'Please complete the email field.';
      return;
    }

    if (this.settingsNewPassword && this.settingsNewPassword.length < 8) {
      this.settingsError = 'New password must be at least 8 characters.';
      return;
    }

    if (this.settingsNewPassword && !this.settingsCurrentPassword) {
      this.settingsError = 'Enter current password to change password.';
      return;
    }

    const payload: { email: string; currentPassword?: string; newPassword?: string } = { email };
    if (this.settingsNewPassword) {
      payload.currentPassword = this.settingsCurrentPassword;
      payload.newPassword = this.settingsNewPassword;
    }

    this.http
      .patch<{ message: string; token: string; user: AuthUser }>(`${this.apiBaseUrl}/account`, payload, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          localStorage.setItem('crf_auth_token', response.token);
          localStorage.setItem('crf_auth_user', JSON.stringify(response.user));
          this.authToken = response.token;
          this.currentUser = response.user;
          this.settingsCurrentPassword = '';
          this.settingsNewPassword = '';
          this.settingsSuccess = response.message || 'Settings saved.';
        },
        error: (err) => {
          this.settingsError = err?.error?.error || 'Could not save account settings right now.';
        },
      });
  }

  openDeleteModal(): void {
    this.deleteError = '';
    this.deletePassword = '';
    this.showDeletePassword = false;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletePassword = '';
    this.showDeletePassword = false;
    this.deleteError = '';
  }

  confirmDeleteAccount(): void {
    if (!this.deletePassword.trim()) {
      this.deleteError = 'Please enter your password to confirm deletion.';
      return;
    }

    this.http
      .delete<{ message: string }>(`${this.apiBaseUrl}/account`, {
        headers: this.getAuthHeaders(),
        body: { currentPassword: this.deletePassword.trim() },
      })
      .subscribe({
        next: (response) => {
          if (this.currentUser) {
            localStorage.removeItem(`crf_saved_resources_${this.currentUser.id}`);
            localStorage.removeItem(`crf_recent_searches_${this.currentUser.id}`);
            localStorage.removeItem(`crf_flagged_resources_${this.currentUser.id}`);
            localStorage.removeItem(`crf_update_requests_${this.currentUser.id}`);
          }
          this.clearAuthSession();
          this.closeDeleteModal();
          this.loginSuccess = response.message || 'Account deleted. You have been logged out.';
          this.loginError = '';
          this.viewMode = 'login';
        },
        error: (err) => {
          this.deleteError = err?.error?.error || 'Could not delete account right now.';
        },
      });
  }

  viewFlaggedResource(itemId: string): void {
    this.expandedFlaggedResourceId = this.expandedFlaggedResourceId === itemId ? null : itemId;
  }

  withdrawUpdateRequest(requestId: string): void {
    this.updateRequests = this.updateRequests.filter((item) => item.id !== requestId);
    this.persistUpdateRequests();
  }

  submitZipUpdateRequest(): void {
    this.updateRequestError = '';
    this.updateRequestSuccess = '';

    const zip = this.updateRequestZip.trim();
    const note = this.updateRequestNote.trim();

    if (!/^\d{5}$/.test(zip)) {
      this.updateRequestError = 'Enter a valid 5-digit ZIP code.';
      return;
    }
    if (!note) {
      this.updateRequestError = 'Please add what resources should be included for this ZIP.';
      return;
    }

    const submittedAt = new Date().toISOString();
    const item: UpdateRequestItem = {
      id: `zipreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      resource: {
        id: `zip-resource-${Date.now()}`,
        name: `Resources requested for ZIP ${zip}`,
        address: `Requested service area ${zip}`,
        city: null,
        state: 'NJ',
        zip_code: zip,
        phone_number: null,
        category_name: null,
      },
      note,
      submittedAt,
      submittedDateLabel: this.getFlaggedDateLabel(submittedAt),
      status: 'pending',
    };

    this.updateRequests = [item, ...this.updateRequests];
    this.persistUpdateRequests();
    this.updateRequestSuccess = 'Request submitted to include resources for this ZIP.';
    this.updateRequestZip = '';
    this.updateRequestNote = '';
  }

  getUpdateRequestStatusLabel(status: UpdateRequestStatus): string {
    if (status === 'pending') return '⏳ Pending';
    if (status === 'reviewed') return '✓ Reviewed';
    return '✕ Not accepted';
  }

  getUpdateRequestStatusClass(status: UpdateRequestStatus): string {
    if (status === 'pending') return 'status-pending';
    if (status === 'reviewed') return 'status-reviewed';
    return 'status-declined';
  }

  removeFlaggedResource(itemId: string): void {
    this.flaggedResources = this.flaggedResources.filter((item) => item.id !== itemId);
    this.persistFlaggedResources();
    if (this.expandedFlaggedResourceId === itemId) {
      this.expandedFlaggedResourceId = null;
    }
  }

  openForgotPassword(): void {
    this.viewMode = 'forgotPassword';
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    this.forgotPasswordEmail = this.loginEmail.trim();
  }

  backToLogin(): void {
    this.viewMode = 'login';
    this.forgotPasswordError = '';
  }

  goHome(): void {
    if (this.currentUser) {
      this.clearAuthSession();
    }
    this.viewMode = 'landing';
    this.errorMessage = '';
    this.hasSearched = false;
    this.selectedCategoryId = null;
    this.selectedCategoryLabel = '';
    this.expandedResourceId = null;
    this.lastSearchTerm = '';
    this.resolvedCityName = '';
    this.allResults = [];
    this.filteredResults = [];
    this.searchInput = '';
    this.showSuggestionForm = false;
    this.submissionError = '';
    this.submissionSuccess = '';
    this.authMessage = '';
    this.loadSavedResources();
  }

  handleTopTitleClick(): void {
    if (this.currentUser) return;
    this.goHome();
  }

  submitLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';

    const email = this.loginEmail.trim();
    const password = this.loginPassword;

    if (!email || !password) {
      this.loginError = 'Please enter both email and password.';
      return;
    }

    this.isLoggingIn = true;
    this.http
      .post<{ token: string; user: { name?: string; email: string; role?: 'user' | 'admin' } }>(
        `${this.apiBaseUrl}/auth/login`,
        {
          email,
          password,
        }
      )
      .subscribe({
        next: (response) => {
          this.isLoggingIn = false;
          const returnedRole = (response.user?.role || 'user') as 'user' | 'admin';
          if (returnedRole !== this.loginRole) {
            this.loginError = `This account is registered as ${returnedRole}. Please switch login type.`;
            return;
          }
          localStorage.setItem('crf_auth_token', response.token);
          localStorage.setItem('crf_auth_user', JSON.stringify(response.user));
          this.loadAuthSession();
          this.savedResources = [];
          this.recentSearches = [];
          this.flaggedResources = [];
          this.updateRequests = [];
          this.loadSavedResources();
          this.loadFlaggedResources();
          this.loadUpdateRequests();
          this.refreshRecentSearches();
          this.loginSuccess = `Signed in successfully${response.user?.name ? `, ${response.user.name}` : ''}.`;
          this.viewMode = returnedRole === 'user' ? 'userDashboard' : 'landing';
        },
        error: (err) => {
          this.isLoggingIn = false;
          this.loginError = err?.error?.error || 'Sign-in failed. Please check your credentials.';
        },
      });
  }

  logout(): void {
    this.clearAuthSession();
    this.authMessage = 'You have been logged out.';
    this.viewMode = 'landing';
  }

  syncSavedResourcesFromServer(showStatus = true): void {
    if (!this.currentUser || !this.authToken) return;
    this.isSyncingSaved = true;
    if (showStatus) {
      this.authMessage = '';
    }

    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/saved`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (serverSaved) => {
          this.savedResources = serverSaved;
          this.persistSavedResources();
          this.isSyncingSaved = false;
          if (showStatus) {
            this.authMessage = 'Loaded saved resources from your account.';
          }
        },
        error: () => {
          this.isSyncingSaved = false;
          if (showStatus) {
            this.authMessage = 'Could not connect account saved resources.';
          }
        },
      });
  }

  submitForgotPassword(): void {
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';

    const email = this.forgotPasswordEmail.trim();
    if (!email) {
      this.forgotPasswordError = 'Please enter your email address.';
      return;
    }

    this.isSendingResetLink = true;
    this.http
      .post<{ message?: string }>(`${this.apiBaseUrl}/auth/forgot-password`, { email })
      .subscribe({
        next: () => {
          this.isSendingResetLink = false;
          this.forgotPasswordSuccess =
            "Check your inbox. If an account exists for that email, you'll receive a reset link within a few minutes.";
        },
        error: () => {
          this.isSendingResetLink = false;
          this.forgotPasswordSuccess =
            "Check your inbox. If an account exists for that email, you'll receive a reset link within a few minutes.";
        },
      });
  }

  submitRegister(): void {
    this.registerError = '';
    this.registerSuccess = '';

    const firstName = this.registerFirstName.trim();
    const lastName = this.registerLastName.trim();
    const email = this.registerEmail.trim();
    const password = this.registerPassword;
    const confirmPassword = this.registerConfirmPassword;
    const fullName = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      this.registerError = 'Please complete all fields.';
      return;
    }
    if (password.length < 8) {
      this.registerError = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== confirmPassword) {
      this.registerError = 'Passwords do not match.';
      return;
    }

    this.isRegistering = true;
    this.http
      .post<{ message?: string }>(`${this.apiBaseUrl}/auth/register`, {
        name: fullName,
        email,
        role: this.registerRole,
        password,
      })
      .subscribe({
        next: () => {
          this.isRegistering = false;
          this.registerSuccess =
            'Account created. Check your email for the verification link, then sign in.';
          this.loginEmail = email;
          this.registerPassword = '';
          this.registerConfirmPassword = '';
        },
        error: (err) => {
          this.isRegistering = false;
          this.registerError = err?.error?.error || 'Could not create account right now. Please try again.';
        },
      });
  }

  showSuggestResourcePrompt(): void {
    this.showSuggestionForm = true;
    this.submissionError = '';
    this.submissionSuccess = '';
    this.suggestionForm.zipOrCity = this.lastSearchTerm || this.searchInput.trim();
    if (this.selectedCategoryId) {
      this.suggestionForm.categoryId = this.selectedCategoryId;
    }
  }

  setSuggestionCategory(categoryId: number): void {
    this.suggestionForm.categoryId = categoryId;
  }

  submitSuggestion(): void {
    this.submissionError = '';
    this.submissionSuccess = '';

    if (!this.suggestionForm.zipOrCity.trim()) {
      this.submissionError = 'Please enter zip code/city for the suggestion.';
      return;
    }
    if (!this.suggestionForm.categoryId) {
      this.submissionError = 'Please choose a resource type.';
      return;
    }

    this.isSubmittingSuggestion = true;
    this.http
      .post<{ message: string }>(`${this.apiBaseUrl}/submissions`, {
        zipOrCity: this.suggestionForm.zipOrCity.trim(),
        categoryId: this.suggestionForm.categoryId,
        notes: this.suggestionForm.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.isSubmittingSuggestion = false;
          this.submissionSuccess = 'Suggestion sent. Admin will review it.';
          this.suggestionForm = {
            zipOrCity: this.lastSearchTerm || this.suggestionForm.zipOrCity,
            categoryId: this.suggestionForm.categoryId,
            notes: '',
          };
        },
        error: () => {
          this.isSubmittingSuggestion = false;
          this.submissionError = 'Could not submit suggestion right now. Please try again.';
        },
      });
  }

  backToLanding(): void {
    this.viewMode = 'landing';
    this.expandedResourceId = null;
  }

  toggleResourceDetails(resourceId: string): void {
    this.expandedResourceId = this.expandedResourceId === resourceId ? null : resourceId;
  }

  get selectedCategory(): CategoryOption | undefined {
    return this.categories.find((item) => item.id === this.selectedCategoryId);
  }

  getLocationSubtitle(): string {
    if (!this.lastSearchTerm && !this.resolvedCityName) return 'Enter zip code/city name to get resources';
    const state = this.filteredResults[0]?.state || 'NJ';
    return `Near ${this.lastSearchTerm} · ${this.resolvedCityName}, ${state}`;
  }

  getResourceTags(resource: Resource): ResourceTag[] {
    const tags: ResourceTag[] = [];
    const todayHours = this.getTodayHours(resource);
    if (todayHours) {
      if (/closed/i.test(todayHours)) {
        tags.push({ label: 'Closed today', className: 'tag-closed' });
      } else {
        tags.push({ label: 'Open today', className: 'tag-open' });
      }
    } else {
      tags.push({ label: 'Hours not listed', className: 'tag-info' });
    }

    if (resource.is_verified) {
      tags.push({ label: 'Verified', className: 'tag-verified' });
    }

    if (resource.website) {
      tags.push({ label: 'Website listed', className: 'tag-info' });
    }

    if (resource.phone_number) {
      tags.push({ label: 'Phone listed', className: 'tag-info' });
    }

    return tags.slice(0, 4);
  }

  getHoursLine(resource: Resource): string {
    const hours = this.getTodayHours(resource) || 'Hours not listed';
    const phone = resource.phone_number || 'Phone not listed';
    return `${hours} · ${phone}`;
  }

  getGoogleMapsUrl(resource: Resource): string {
    const city = resource.city || this.resolvedCityName || '';
    const state = resource.state || 'NJ';
    const location = `${resource.address}, ${city}, ${state} ${resource.zip_code}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }

  getGoogleMapsEmbedUrl(resource: Resource): SafeResourceUrl {
    const city = resource.city || this.resolvedCityName || '';
    const state = resource.state || 'NJ';
    const location = `${resource.address}, ${city}, ${state} ${resource.zip_code}`.trim();
    const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getResultIcon(index: number): string {
    const iconSets: Record<string, string[]> = {
      food: ['🥫', '🍽️', '🤝', '🥦', '🍎'],
      health: ['🏥', '🩺', '💊', '🧠', '🧑‍⚕️'],
      jobs: ['💼', '📄', '🛠️', '🎓', '📈'],
      housing: ['🏠', '🛏️', '🔑', '🏢', '🧱'],
      legal: ['⚖️', '📜', '🧾', '🛡️', '🏛️'],
      government: ['🏛️', '🗂️', '📋', '🧭', '🪪'],
    };
    const list = iconSets[this.selectedCategoryLabel.toLowerCase()] || ['📍'];
    return list[index % list.length];
  }

  getDistanceLabel(resource: Resource): string {
    if (!this.userLocation) return '';
    const lat = Number(resource.latitude);
    const lng = Number(resource.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Distance unavailable';

    const miles = this.calculateDistanceMiles(this.userLocation.lat, this.userLocation.lng, lat, lng);
    return `${miles.toFixed(1)} mi`;
  }

  getSavedResourceHours(resource: Resource): string {
    return this.getTodayHours(resource) || 'Hours not listed';
  }

  isSavedResource(resourceId: string): boolean {
    return this.savedResources.some((item) => item.id === resourceId);
  }

  toggleSaveResource(resource: Resource): void {
    const exists = this.savedResources.some((item) => item.id === resource.id);
    if (exists) {
      this.savedResources = this.savedResources.filter((item) => item.id !== resource.id);
    } else {
      this.savedResources = [resource, ...this.savedResources].slice(0, 200);
    }
    this.persistSavedResources();

    if (!this.currentUser || !this.authToken) return;

    if (exists) {
      this.http
        .delete(`${this.apiBaseUrl}/saved/${resource.id}`, { headers: this.getAuthHeaders() })
        .subscribe({
          error: () => {
            this.authMessage = 'Could not unsave from account. Local save was updated only.';
          },
        });
      return;
    }

    this.http
      .post(
        `${this.apiBaseUrl}/saved`,
        { resourceId: resource.id },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        error: () => {
          this.authMessage = 'Could not save to account. Local save still worked.';
        },
      });
  }

  openFlagResource(resourceId: string): void {
    this.flaggingResourceId = resourceId;
    this.flagReason = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  cancelFlagResource(): void {
    this.flaggingResourceId = null;
    this.flagReason = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  submitFlagResource(resource: Resource): void {
    this.flagError = '';
    this.flagSuccess = '';

    if (!this.currentUser) {
      this.flagError = 'Please log in as a user to flag resources.';
      return;
    }

    const categoryId = this.getCategoryIdByName(resource.category_name);
    if (!categoryId) {
      this.flagError = 'Could not identify category for this resource.';
      return;
    }

    const reason = this.flagReason.trim();
    if (!reason) {
      this.flagError = 'Please describe what needs review.';
      return;
    }

    const zipOrCity = resource.zip_code || resource.city || this.lastSearchTerm || 'Unknown area';
    this.http
      .post<{ message: string }>(`${this.apiBaseUrl}/submissions`, {
        zipOrCity,
        categoryId,
        resourceName: resource.name,
        notes: `FLAGGED RESOURCE (${resource.id}) by ${this.currentUser.email}: ${reason}`,
      })
      .subscribe({
        next: () => {
          const flaggedAt = new Date().toISOString();
          const flaggedItem: FlaggedResourceItem = {
            id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            resource: { ...resource },
            reason,
            flaggedAt,
            flaggedDateLabel: this.getFlaggedDateLabel(flaggedAt),
          };
          this.flaggedResources = [flaggedItem, ...this.flaggedResources];
          this.persistFlaggedResources();

          const requestItem: UpdateRequestItem = {
            id: flaggedItem.id,
            resource: { ...resource },
            note: reason,
            submittedAt: flaggedAt,
            submittedDateLabel: this.getFlaggedDateLabel(flaggedAt),
            status: 'pending',
          };
          this.updateRequests = [requestItem, ...this.updateRequests];
          this.persistUpdateRequests();

          this.flagSuccess = 'Flag sent for admin review. Thank you.';
          this.flagReason = '';
          this.flaggingResourceId = null;
          if (this.viewMode === 'userDashboard') {
            this.dashboardTab = 'flagged';
          }
        },
        error: () => {
          this.flagError = 'Could not submit flag right now. Please try again.';
        },
      });
  }

  private persistSavedResources(): void {
    localStorage.setItem(this.getSavedResourcesKey(), JSON.stringify(this.savedResources));
  }

  private persistFlaggedResources(): void {
    localStorage.setItem(this.getFlaggedResourcesKey(), JSON.stringify(this.flaggedResources));
  }

  private persistUpdateRequests(): void {
    localStorage.setItem(this.getUpdateRequestsKey(), JSON.stringify(this.updateRequests));
  }

  private loadSavedResources(): void {
    if (this.currentUser && this.authToken) {
      const localAccountCache = localStorage.getItem(this.getSavedResourcesKey());
      if (localAccountCache) {
        try {
          const parsed = JSON.parse(localAccountCache);
          this.savedResources = Array.isArray(parsed) ? parsed : [];
        } catch {
          this.savedResources = [];
        }
      } else {
        this.savedResources = [];
      }
      this.syncSavedResourcesFromServer(false);
      return;
    }

    const raw = localStorage.getItem(this.getSavedResourcesKey());
    if (!raw) {
      this.savedResources = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.savedResources = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.savedResources = [];
    }
  }

  private loadFlaggedResources(): void {
    const raw = localStorage.getItem(this.getFlaggedResourcesKey());
    if (!raw) {
      this.flaggedResources = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.flaggedResources = Array.isArray(parsed) ? parsed : [];
      this.flaggedResources = this.flaggedResources.map((item) => ({
        ...item,
        flaggedDateLabel: this.getFlaggedDateLabel(item.flaggedAt || new Date().toISOString()),
      }));
    } catch {
      this.flaggedResources = [];
    }
  }

  private loadUpdateRequests(): void {
    const raw = localStorage.getItem(this.getUpdateRequestsKey());
    if (!raw) {
      this.updateRequests = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.updateRequests = Array.isArray(parsed) ? parsed : [];
      this.updateRequests = this.updateRequests.map((item) => ({
        ...item,
        submittedDateLabel: this.getFlaggedDateLabel(item.submittedAt || new Date().toISOString()),
      }));
    } catch {
      this.updateRequests = [];
    }
  }

  private getTodayHours(resource: Resource): string | null {
    if (!resource.hours_of_operation) return null;

    const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
    const lines = resource.hours_of_operation
      .split('|')
      .map((line) => line.trim())
      .filter(Boolean);

    const todayLine = lines.find((line) => line.toLowerCase().startsWith(todayName));
    return todayLine || null;
  }

  private calculateDistanceMiles(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;

    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(fromLat)) *
        Math.cos(toRadians(toLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMiles * c;
  }

  private pickCityName(rows: Resource[], fallback: string): string {
    if (!rows.length) return fallback;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const city = (row.city || '').trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) || 0) + 1);
    }

    if (counts.size === 0) return fallback;

    let bestCity = fallback;
    let bestCount = 0;
    counts.forEach((count, city) => {
      if (count > bestCount) {
        bestCount = count;
        bestCity = city;
      }
    });
    return bestCity;
  }

  private saveRecentSearch(term: string): void {
    const key = this.getRecentSearchesKey();
    const current = this.getRecentSearches();
    const deduped = [term, ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(deduped));
    this.refreshRecentSearches();
  }

  private getRecentSearches(): string[] {
    const key = this.getRecentSearchesKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return [];
    }
  }

  private refreshRecentSearches(): void {
    this.recentSearches = this.getRecentSearches();
  }

  private loadAuthSession(): void {
    const token = localStorage.getItem('crf_auth_token');
    const rawUser = localStorage.getItem('crf_auth_user');
    if (!token || !rawUser) {
      this.currentUser = null;
      this.authToken = '';
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as AuthUser;
      this.currentUser = parsed;
      this.authToken = token;
    } catch {
      this.currentUser = null;
      this.authToken = '';
      localStorage.removeItem('crf_auth_token');
      localStorage.removeItem('crf_auth_user');
    }
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authToken}`,
    });
  }

  private getCategoryIdByName(categoryName: string | null): number | null {
    if (!categoryName) return null;
    const match = this.categories.find((item) => item.label.toLowerCase() === categoryName.toLowerCase());
    return match?.id ?? null;
  }

  private clearAuthSession(): void {
    localStorage.removeItem('crf_auth_token');
    localStorage.removeItem('crf_auth_user');
    this.currentUser = null;
    this.authToken = '';
    this.userLocation = null;
    this.locationStatusMessage = '';
    this.loadSavedResources();
    this.loadFlaggedResources();
    this.loadUpdateRequests();
    this.refreshRecentSearches();
  }

  private initializeSettingsFormFromCurrentUser(): void {
    const fullName = (this.currentUser?.name || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    this.settingsFirstName = parts[0] || '';
    this.settingsLastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    this.settingsEmail = this.currentUser?.email || '';
    this.settingsCurrentPassword = '';
    this.showSettingsCurrentPassword = false;
    this.settingsNewPassword = '';
    this.showSettingsNewPassword = false;
  }

  private loadDashboardNotifications(): void {
    if (!this.currentUser || !this.authToken) {
      this.dashboardNotifications = [];
      return;
    }

    this.http
      .get<ApiNotificationRow[]>(`${this.apiBaseUrl}/notifications`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          this.dashboardNotifications = rows.map((row, index) => {
            const category = this.normalizeNotificationCategory(row.category_name);
            const actionText = this.getNotificationActionLabel(row.action);
            const locationBits = [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(', ');
            const details = locationBits
              ? `${actionText} in database for ${row.resource_name}. Location: ${locationBits}.`
              : `${actionText} in database for ${row.resource_name}.`;

            return {
              id: row.notification_id || `${row.resource_id}-${row.created_at}-${index}`,
              title: `${row.resource_name} was ${row.action}`,
              details,
              category,
              dateLabel: this.getFlaggedDateLabel(row.created_at),
              isUnread: index < 3,
            };
          });
        },
        error: () => {
          this.dashboardNotifications = [];
          this.authMessage = 'Could not load notifications from database edits.';
        },
      });
  }

  private normalizeNotificationCategory(categoryName: string | null): NotificationItem['category'] {
    const normalized = (categoryName || '').toLowerCase();
    const allowed: NotificationItem['category'][] = ['food', 'health', 'housing', 'jobs', 'legal', 'government'];
    if (allowed.includes(normalized as NotificationItem['category'])) {
      return normalized as NotificationItem['category'];
    }
    return 'government';
  }

  private getNotificationActionLabel(action: string): string {
    if (action === 'created') return 'New listing created';
    if (action === 'updated') return 'Listing updated';
    if (action === 'verified') return 'Listing verified';
    if (action === 'deleted') return 'Listing deleted';
    return 'Listing changed';
  }

  private getSavedResourcesKey(): string {
    if (!this.currentUser) return this.guestSavedResourcesKey;
    return `crf_saved_resources_${this.currentUser.id}`;
  }

  private getRecentSearchesKey(): string {
    if (!this.currentUser) return this.guestRecentSearchesKey;
    return `crf_recent_searches_${this.currentUser.id}`;
  }

  private getFlaggedResourcesKey(): string {
    if (!this.currentUser) return this.guestFlaggedResourcesKey;
    return `crf_flagged_resources_${this.currentUser.id}`;
  }

  private getUpdateRequestsKey(): string {
    if (!this.currentUser) return this.guestUpdateRequestsKey;
    return `crf_update_requests_${this.currentUser.id}`;
  }

  private getFlaggedDateLabel(isoDate: string): string {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
