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
  description?: string | null;
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
  category_id?: number | null;
  save_count?: number | string | null;
  flag_count?: number | string | null;
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
  changes: Record<string, unknown> | null;
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
  submissionId?: string;
  status?: 'pending' | 'corrected' | 'declined';
  statusLabel?: string;
  handledSummary?: string;
  adminReviewNote?: string | null;
};

type UserSubmissionStatusRow = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  review_notes?: string | null;
  updated_at: string;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  reviewer_email?: string | null;
  submission_kind: 'flag' | 'zip_request';
};

type UpdateRequestStatus = 'pending' | 'reviewed' | 'declined';

type UpdateRequestItem = {
  id: string;
  resource: Resource;
  note: string;
  submittedAt: string;
  submittedDateLabel: string;
  status: UpdateRequestStatus;
  handledSummary?: string;
  adminReviewNote?: string | null;
};

type AdminSubmissionRow = {
  id: string;
  submitter_name?: string | null;
  submitter_contact?: string | null;
  notes?: string | null;
  resource_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  reviewer_email?: string | null;
  zip_or_city: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at?: string | null;
};

type UserAdminMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_user_id: string;
  sender_name?: string | null;
  sender_role?: string;
};

type UserMessagesApiResponse = {
  messages: UserAdminMessage[];
  threadArchivedByStaff: boolean;
};

type AdminInboxMessageRow = {
  id: string;
  body: string;
  created_at: string;
  thread_user_id: string;
  sender_user_id: string;
  thread_user_email: string;
  thread_user_first_name?: string | null;
  thread_user_last_name?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_role: string;
};

type AdminMessageThreadSummary = {
  threadUserId: string;
  label: string;
  lastMessageAt: string;
  preview: string;
};

type AdminUserAccount = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  role: 'user' | 'admin';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

type AccountProfileResponse = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  name: string;
  role: string;
  isEmailVerified: boolean;
  created_at: string;
  updated_at: string;
};

type AdminZipCategoryKey = 'food' | 'health' | 'jobs' | 'housing' | 'legal' | 'government' | 'all';

type AdminEditResourceForm = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  hoursOfOperation: string;
  website: string;
  isVerified: boolean;
};

type AdminZipSummaryRow = {
  zip: string;
  city: string;
  food: number;
  health: number;
  jobs: number;
  housing: number;
  legal: number;
  government: number;
  total: number;
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
  viewMode:
    | 'landing'
    | 'categoryResults'
    | 'savedResources'
    | 'login'
    | 'forgotPassword'
    | 'register'
    | 'userDashboard'
    | 'adminDashboard' = 'landing';
  expandedResourceId: string | null = null;
  lastSearchTerm = '';
  resolvedCityName = '';
  allResults: Resource[] = [];
  filteredResults: Resource[] = [];
  savedResources: Resource[] = [];
  currentUser: AuthUser | null = null;
  dashboardTab:
    | 'dashboard'
    | 'notifications'
    | 'saved'
    | 'flagged'
    | 'updateRequests'
    | 'messages'
    | 'settings' = 'dashboard';
  authToken = '';
  authMessage = '';
  isSyncingSaved = false;
  flaggingResourceId: string | null = null;
  expandedFlaggedResourceId: string | null = null;
  flagReason = '';
  /** Optional email or phone for anonymous flag follow-up (never required). */
  guestFlagContact = '';
  flagError = '';
  flagSuccess = '';
  verifyRequestResourceId: string | null = null;
  verifyRequestError = '';
  verifyRequestSuccess = '';
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
  updateRequestError = '';
  updateRequestSuccess = '';
  userAdminMessages: UserAdminMessage[] = [];
  /** Latest message time (ISO) the member has seen in the staff thread; drives unread badge. */
  private staffThreadLastReadAt: string | null = null;
  /** True when admin archived this member's thread (member sees closed-chat UI). */
  userThreadArchivedByStaff = false;
  /** Member tapped "Start a new message" while thread was archived. */
  userChoseContinueStaffChat = false;
  /** Member Messages tab: summary row first; tap to open full thread. */
  userStaffThreadExpanded = false;
  userMessageBody = '';
  userMessageError = '';
  userMessageSuccess = '';
  isLoadingUserMessages = false;
  isSendingUserMessage = false;
  showZipResourceRequestPrompt = false;
  zipResourceRequestDecision: 'yes' | 'no' | '' = '';
  zipResourceRequestError = '';
  zipResourceRequestSuccess = '';
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
  /** Audit log IDs the user chose to hide (persisted per account in localStorage). */
  private dismissedNotificationIds = new Set<string>();
  /** ZIP requests the user hid from their dashboard after review (local only). */
  private userZipRequestArchivedViewIds = new Set<string>();
  adminTab: 'resources' | 'messages' | 'zipRequests' | 'flagged' | 'accounts' | 'settings' = 'resources';
  adminInboxMessages: AdminInboxMessageRow[] = [];
  /** Active vs archived member threads (admin inbox). */
  adminMessagesScope: 'active' | 'archived' = 'active';
  /** ZIP request queue: active (non-cancelled) vs user-cancelled archive. */
  adminZipRequestsScope: 'active' | 'archive' = 'active';
  /** Conversation count for active inbox only (sidebar badge). */
  adminMessagesActiveThreadCount = 0;
  isLoadingAdminMessages = false;
  adminSelectedThreadUserId: string | null = null;
  adminReplyBody = '';
  adminReplyError = '';
  adminReplySuccess = '';
  isSendingAdminReply = false;
  isArchivingAdminThread = false;
  adminArchiveThreadError = '';
  /** Set when GET /admin/messages fails (e.g. DB or network). */
  adminMessagesLoadError = '';
  adminAccountProfile: AccountProfileResponse | null = null;
  adminAccountProfileError = '';
  isLoadingAdminAccountProfile = false;
  adminSearchTerm = '';
  adminZipImportCode = '';
  adminResources: Resource[] = [];
  adminZipRows: AdminZipSummaryRow[] = [];
  adminSubmissions: AdminSubmissionRow[] = [];
  adminUsers: AdminUserAccount[] = [];
  adminDashboardError = '';
  isAdminLoading = false;
  isAdminImportingZip = false;
  adminZipImportProgress = 0;
  adminZipImportElapsedSeconds = 0;
  adminZipImportError = '';
  adminZipImportSuccess = '';
  adminSelectedZip = '';
  adminSelectedCategoryKey: AdminZipCategoryKey = 'all';
  adminSelectedCategoryLabel = '';
  adminSelectedResources: Resource[] = [];
  adminExpandedFlagResourceId: string | null = null;
  adminExpandedResourceDetailId: string | null = null;
  adminEditingResourceId: string | null = null;
  adminEditingSubmissionId: string | null = null;
  adminEditPanelCollapsed = false;
  adminEditError = '';
  adminEditSuccess = '';
  isAdminSavingEdit = false;
  adminSubmissionSavingId: string | null = null;
  adminZipSubmissionDeletingId: string | null = null;
  adminFlaggedSubmissionDeletingId: string | null = null;
  adminSubmissionActionMessage = '';
  adminSubmissionActionError = '';
  adminReviewNotes: Record<string, string> = {};
  adminExpandedUserId: string | null = null;
  adminUserDeletingId: string | null = null;
  adminUserActionMessage = '';
  adminUserActionError = '';
  showAdminDeleteMemberModal = false;
  adminDeleteMemberTarget: AdminUserAccount | null = null;
  adminDeleteMemberPassword = '';
  adminDeleteMemberError = '';
  showAdminDeleteMemberPassword = false;
  showDismissFlagModal = false;
  dismissFlagSubmissionTarget: AdminSubmissionRow | null = null;
  adminEditForm: AdminEditResourceForm = {
    name: '',
    address: '',
    city: '',
    state: 'NJ',
    zipCode: '',
    phoneNumber: '',
    hoursOfOperation: '',
    website: '',
    isVerified: false,
  };

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

  /** Re-sync flagged / ZIP submission status when the user returns to the tab. */
  private readonly onDocumentVisibility = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (!this.currentUser || !this.authToken || this.currentUser.role !== 'user') return;
    if (this.viewMode !== 'userDashboard') return;
    if (this.dashboardTab !== 'flagged' && this.dashboardTab !== 'updateRequests') return;
    this.refreshMySubmissionsFromServer();
  };

  private adminZipImportTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadAuthSession();
    this.loadSavedResources();
    this.loadFlaggedResources();
    this.loadUpdateRequests();
    this.refreshRecentSearches();
    if (this.currentUser && this.authToken) {
      this.loadDashboardNotifications();
      if (this.currentUser.role === 'user') {
        this.loadUserAdminMessages();
        this.refreshMySubmissionsFromServer();
      }
    }
    this.isOffline = !navigator.onLine;
    window.addEventListener('offline', this.onOfflineHandler);
    window.addEventListener('online', this.onOnlineHandler);
    document.addEventListener('visibilitychange', this.onDocumentVisibility);
  }

  ngOnDestroy(): void {
    this.stopAdminZipImportTimer();
    window.removeEventListener('offline', this.onOfflineHandler);
    window.removeEventListener('online', this.onOnlineHandler);
    document.removeEventListener('visibilitychange', this.onDocumentVisibility);
  }

  private startAdminZipImportTimer(): void {
    this.stopAdminZipImportTimer();
    this.adminZipImportProgress = 6;
    this.adminZipImportElapsedSeconds = 0;
    this.adminZipImportTimer = setInterval(() => {
      this.adminZipImportElapsedSeconds += 1;
      if (this.adminZipImportProgress < 55) {
        this.adminZipImportProgress += 5;
      } else if (this.adminZipImportProgress < 80) {
        this.adminZipImportProgress += 3;
      } else if (this.adminZipImportProgress < 92) {
        this.adminZipImportProgress += 1;
      }
    }, 500);
  }

  private stopAdminZipImportTimer(): void {
    if (!this.adminZipImportTimer) return;
    clearInterval(this.adminZipImportTimer);
    this.adminZipImportTimer = null;
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
    this.loadDashboardNotifications();
    if (this.currentUser.role === 'user') {
      this.loadUserAdminMessages();
      this.refreshMySubmissionsFromServer();
    }
  }

  openAdminDashboard(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      this.openLogin();
      return;
    }
    this.adminTab = 'resources';
    this.viewMode = 'adminDashboard';
    this.adminDashboardError = '';
    this.loadAdminDashboardData();
  }

  openAdminTab(tab: 'resources' | 'messages' | 'zipRequests' | 'flagged' | 'accounts' | 'settings'): void {
    this.adminTab = tab;
    this.adminDashboardError = '';
    this.adminSubmissionActionMessage = '';
    this.adminSubmissionActionError = '';
    if (tab === 'resources') {
      this.loadAdminResources();
      return;
    }
    if (tab === 'messages') {
      this.adminMessagesScope = 'active';
      this.adminMessagesLoadError = '';
      this.loadAdminInboxMessages();
      return;
    }
    if (tab === 'zipRequests' || tab === 'flagged') {
      if (tab === 'zipRequests') {
        this.adminZipRequestsScope = 'active';
      }
      this.loadAdminSubmissions();
      if (tab === 'flagged') {
        this.loadAdminResources();
      }
    }
    if (tab === 'accounts') {
      this.loadAdminUsers();
    }
    if (tab === 'settings') {
      this.loadAdminAccountProfile();
    }
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

  get adminResourceTotalCount(): number {
    return this.adminResources.length;
  }

  get adminPendingSubmissionCount(): number {
    return this.adminSubmissions.filter((item) => item.status === 'pending').length;
  }

  get adminPendingFlaggedSubmissions(): AdminSubmissionRow[] {
    return this.adminSubmissions.filter((item) => item.status === 'pending' && this.isFlagSubmission(item));
  }

  get adminCompletedFlaggedSubmissions(): AdminSubmissionRow[] {
    return this.adminSubmissions
      .filter((item) => item.status !== 'pending' && this.isFlagSubmission(item))
      .sort((a, b) => {
        const ta = new Date(a.reviewed_at || a.updated_at || 0).getTime();
        const tb = new Date(b.reviewed_at || b.updated_at || 0).getTime();
        return tb - ta;
      });
  }

  get adminZipCodeRequests(): AdminSubmissionRow[] {
    return this.adminSubmissions.filter((item) => this.isZipCodeRequest(item));
  }

  get adminZipCodeRequestsActive(): AdminSubmissionRow[] {
    return this.adminZipCodeRequests.filter((item) => item.status !== 'cancelled');
  }

  get adminZipCodeRequestsCancelled(): AdminSubmissionRow[] {
    return this.adminZipCodeRequests.filter((item) => item.status === 'cancelled');
  }

  get adminZipRequestsListForScope(): AdminSubmissionRow[] {
    return this.adminZipRequestsScope === 'archive'
      ? this.adminZipCodeRequestsCancelled
      : this.adminZipCodeRequestsActive;
  }

  get adminPendingZipCodeRequests(): AdminSubmissionRow[] {
    return this.adminZipCodeRequestsActive.filter((item) => item.status === 'pending');
  }

  setAdminZipRequestsScope(scope: 'active' | 'archive'): void {
    this.adminZipRequestsScope = scope;
  }

  get adminUserCount(): number {
    return this.adminUsers.length;
  }

  get adminVisibleZipRows(): AdminZipSummaryRow[] {
    const term = this.adminSearchTerm.trim().toLowerCase();
    if (!term) return this.adminZipRows;
    return this.adminZipRows.filter((row) => row.zip.includes(term) || row.city.toLowerCase().includes(term));
  }

  viewAdminResourcesForZipCategory(zip: string, category: AdminZipCategoryKey): void {
    const normalizedZip = zip.trim();
    if (!normalizedZip) return;

    const filtered = this.filterAdminResourcesByZipCategory(normalizedZip, category);

    const labelMap: Record<AdminZipCategoryKey, string> = {
      food: 'Food',
      health: 'Health',
      jobs: 'Jobs',
      housing: 'Housing',
      legal: 'Legal',
      government: 'Government',
      all: 'All categories',
    };

    this.adminSelectedZip = normalizedZip;
    this.adminSelectedCategoryKey = category;
    this.adminSelectedCategoryLabel = labelMap[category];
    this.adminSelectedResources = filtered;
    this.adminExpandedFlagResourceId = null;
    this.adminExpandedResourceDetailId = null;
    this.cancelAdminResourceEdit();
  }

  backToAdminZipTable(): void {
    this.adminSelectedZip = '';
    this.adminSelectedCategoryKey = 'all';
    this.adminSelectedCategoryLabel = '';
    this.adminSelectedResources = [];
    this.adminExpandedFlagResourceId = null;
    this.adminExpandedResourceDetailId = null;
    this.cancelAdminResourceEdit();
  }

  toggleAdminResourceDetails(resourceId: string): void {
    this.adminExpandedResourceDetailId =
      this.adminExpandedResourceDetailId === resourceId ? null : resourceId;
  }

  getAdminSaveCount(resource: Resource): number {
    const value = Number(resource.save_count ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  getAdminFlagCount(resource: Resource): number {
    const value = Number(resource.flag_count ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  getAdminPendingFlags(resource: Resource): AdminSubmissionRow[] {
    return this.adminSubmissions.filter((item) => {
      if (item.status !== 'pending') return false;
      const notes = (item.notes || '').trim();
      return notes.startsWith(`FLAGGED RESOURCE (${resource.id})`);
    });
  }

  getAdminPendingFlagCount(resource: Resource): number {
    return this.getAdminPendingFlags(resource).length;
  }

  getAdminFlagReason(flag: AdminSubmissionRow): string {
    const raw = (flag.notes || '').trim();
    const marker = ': ';
    const markerIndex = raw.indexOf(marker);
    if (markerIndex === -1) return raw || 'No note provided.';
    return raw.slice(markerIndex + marker.length).trim() || 'No note provided.';
  }

  toggleAdminPendingFlags(resourceId: string): void {
    this.adminExpandedFlagResourceId = this.adminExpandedFlagResourceId === resourceId ? null : resourceId;
  }

  isFlagSubmission(submission: AdminSubmissionRow): boolean {
    const note = (submission.notes || '').trim();
    return note.startsWith('FLAGGED RESOURCE (');
  }

  isVerificationSubmission(submission: AdminSubmissionRow): boolean {
    const note = (submission.notes || '').trim().toUpperCase();
    return note.startsWith('VERIFY REQUEST') || note.includes('VERIFICATION REQUEST');
  }

  isZipCodeRequest(submission: AdminSubmissionRow): boolean {
    if (this.isFlagSubmission(submission)) return false;
    if (this.isVerificationSubmission(submission)) return false;
    const zipOrCity = (submission.zip_or_city || '').trim();
    const isZip = /^\d{5}$/.test(zipOrCity);
    if (!isZip) return false;
    return true;
  }

  getAdminSubmissionRequesterName(submission: AdminSubmissionRow): string {
    const name = (submission.submitter_name || '').trim();
    return name || 'Anonymous user';
  }

  getAdminSubmissionCategoryLabel(submission: AdminSubmissionRow): string {
    if (submission.category_name) {
      return submission.category_name;
    }
    if (
      (submission.category_id == null || submission.category_id === undefined) &&
      !this.isFlagSubmission(submission) &&
      !this.isVerificationSubmission(submission)
    ) {
      return 'All resource types';
    }
    return 'Uncategorized';
  }

  getAdminSubmissionRequestText(submission: AdminSubmissionRow): string {
    const raw = (submission.notes || '').trim();
    if (!raw) {
      return `Requested resources for ${submission.zip_or_city}.`;
    }

    const withoutEmail = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[hidden]');
    const withoutIds = withoutEmail.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g, '[resource]');
    const cleaned = withoutIds
      .replace(/^VERIFY REQUEST \(\[resource\]\) by \[hidden\]:\s*/i, 'Requested verification: ')
      .replace(/^FLAGGED RESOURCE \(\[resource\]\) by \[hidden\]:\s*/i, 'Flagged issue: ')
      .trim();

    return cleaned || `Requested resources for ${submission.zip_or_city}.`;
  }

  getAdminReviewNote(submissionId: string): string {
    return this.adminReviewNotes[submissionId] || '';
  }

  setAdminReviewNote(submissionId: string, value: string): void {
    this.adminReviewNotes[submissionId] = value;
  }

  quickImportAdminZipFromRequest(submission: AdminSubmissionRow): void {
    const zipCode = (submission.zip_or_city || '').trim();
    if (!/^\d{5}$/.test(zipCode)) {
      this.adminZipImportError = 'This request does not include a valid 5-digit ZIP code.';
      this.adminZipImportSuccess = '';
      return;
    }

    this.adminZipImportCode = zipCode;
    this.importAdminZipResources(submission);
  }

  importAdminZipResources(sourceSubmission?: AdminSubmissionRow): void {
    this.adminZipImportError = '';
    this.adminZipImportSuccess = '';
    const zipCode = this.adminZipImportCode.trim();

    if (!/^\d{5}$/.test(zipCode)) {
      this.adminZipImportError = 'Enter a valid 5-digit US ZIP code.';
      return;
    }
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminZipImportError = 'Admin session required.';
      return;
    }

    this.isAdminImportingZip = true;
    this.startAdminZipImportTimer();
    this.http
      .post<{ message: string; insertedCount: number; updatedCount?: number; skippedCount: number }>(
        `${this.apiBaseUrl}/admin/resources/import-zip`,
        { zipCode },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (response) => {
          this.stopAdminZipImportTimer();
          this.adminZipImportProgress = 100;
          this.isAdminImportingZip = false;
          const updatedCount = Number(response.updatedCount || 0);
          this.adminZipImportSuccess =
            `${response.message} Added ${response.insertedCount} resources, updated ${updatedCount}, skipped ${response.skippedCount}.`;
          this.loadAdminResources();
          if (sourceSubmission && sourceSubmission.status === 'pending') {
            this.markZipRequestCompleted(sourceSubmission.id);
          } else {
            this.loadAdminSubmissions();
          }
        },
        error: (err) => {
          this.stopAdminZipImportTimer();
          this.adminZipImportProgress = 0;
          this.adminZipImportElapsedSeconds = 0;
          this.isAdminImportingZip = false;
          this.adminZipImportError = err?.error?.error || 'Could not import this ZIP right now.';
        },
      });
  }

  private markZipRequestCompleted(submissionId: string): void {
    if (!this.authToken) {
      this.loadAdminSubmissions();
      return;
    }

    this.http
      .patch<AdminSubmissionRow>(
        `${this.apiBaseUrl}/admin/submissions/${submissionId}/status`,
        { status: 'approved', reviewNotes: 'Completed via ZIP import.' },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (updated) => {
          this.adminSubmissions = this.adminSubmissions.map((item) =>
            item.id === submissionId ? { ...item, ...updated } : item
          );
          this.adminZipImportSuccess = `${this.adminZipImportSuccess} Request marked completed.`;
        },
        error: () => {
          this.loadAdminSubmissions();
        },
      });
  }

  getAdminUserDisplayName(user: AdminUserAccount): string {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    if (fullName) return fullName;
    const emailPrefix = (user.email || '').split('@')[0];
    return emailPrefix || 'User';
  }

  toggleAdminUserDetails(userId: string): void {
    this.adminExpandedUserId = this.adminExpandedUserId === userId ? null : userId;
  }

  openAdminDeleteUserModal(user: AdminUserAccount): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminUserActionError = 'Admin session required.';
      return;
    }
    this.adminDeleteMemberError = '';
    this.adminDeleteMemberPassword = '';
    this.adminDeleteMemberTarget = user;
    this.showAdminDeleteMemberModal = true;
  }

  closeAdminDeleteUserModal(): void {
    if (this.adminUserDeletingId) return;
    this.showAdminDeleteMemberModal = false;
    this.adminDeleteMemberTarget = null;
    this.adminDeleteMemberPassword = '';
    this.adminDeleteMemberError = '';
  }

  confirmAdminDeleteUser(): void {
    const user = this.adminDeleteMemberTarget;
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminUserActionError = 'Admin session required.';
      return;
    }
    if (!user) return;

    const pwd = this.adminDeleteMemberPassword.trim();
    if (!pwd) {
      this.adminDeleteMemberError = 'Enter your admin password to confirm.';
      return;
    }

    this.adminUserDeletingId = user.id;
    this.adminUserActionError = '';
    this.adminUserActionMessage = '';
    this.adminDeleteMemberError = '';

    this.http
      .delete<{ message?: string }>(`${this.apiBaseUrl}/admin/users/${user.id}`, {
        headers: this.getAuthHeaders(),
        body: { currentPassword: pwd },
      })
      .subscribe({
        next: (response) => {
          this.adminUsers = this.adminUsers.filter((item) => item.id !== user.id);
          this.adminUserDeletingId = null;
          this.adminUserActionMessage = response.message || 'User deleted.';
          if (this.adminExpandedUserId === user.id) {
            this.adminExpandedUserId = null;
          }
          this.closeAdminDeleteUserModal();
        },
        error: (err) => {
          this.adminUserDeletingId = null;
          this.adminDeleteMemberError = err?.error?.error || 'Could not delete user account.';
        },
      });
  }

  deleteAdminZipSubmission(submission: AdminSubmissionRow): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminSubmissionActionError = 'Admin session required.';
      return;
    }

    const confirmed = globalThis.confirm(
      `Permanently remove the ZIP request for ${submission.zip_or_city}? This cannot be undone.`
    );
    if (!confirmed) return;

    this.adminZipSubmissionDeletingId = submission.id;
    this.adminSubmissionActionMessage = '';
    this.adminSubmissionActionError = '';

    this.http
      .delete<{ message?: string }>(`${this.apiBaseUrl}/admin/submissions/${submission.id}`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          this.adminSubmissions = this.adminSubmissions.filter((item) => item.id !== submission.id);
          this.adminZipSubmissionDeletingId = null;
          this.adminSubmissionActionMessage = response.message || 'ZIP request removed.';
          delete this.adminReviewNotes[submission.id];
        },
        error: (err) => {
          this.adminZipSubmissionDeletingId = null;
          this.adminSubmissionActionError = err?.error?.error || 'Could not remove this request.';
        },
      });
  }

  /** Opens in-app confirmation before removing the flag submission only (listing stays in the database). */
  openDismissFlagModal(submission: AdminSubmissionRow): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminSubmissionActionError = 'Admin session required.';
      return;
    }
    if (!this.isFlagSubmission(submission)) {
      this.adminSubmissionActionError = 'Only flagged-resource records can be removed here.';
      return;
    }
    this.adminSubmissionActionError = '';
    this.dismissFlagSubmissionTarget = submission;
    this.showDismissFlagModal = true;
  }

  closeDismissFlagModal(): void {
    if (this.adminFlaggedSubmissionDeletingId) {
      return;
    }
    this.showDismissFlagModal = false;
    this.dismissFlagSubmissionTarget = null;
  }

  /** Remove the flag submission after user confirms in the modal. */
  confirmDismissFlag(): void {
    const submission = this.dismissFlagSubmissionTarget;
    if (!submission || !this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      return;
    }
    if (!this.isFlagSubmission(submission)) {
      this.adminSubmissionActionError = 'Only flagged-resource records can be removed here.';
      return;
    }

    this.adminFlaggedSubmissionDeletingId = submission.id;
    this.adminSubmissionActionMessage = '';
    this.adminSubmissionActionError = '';

    this.http
      .delete<{ message?: string }>(`${this.apiBaseUrl}/admin/submissions/${submission.id}`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          this.adminSubmissions = this.adminSubmissions.filter((item) => item.id !== submission.id);
          this.adminFlaggedSubmissionDeletingId = null;
          this.adminSubmissionActionMessage = response.message || 'Flag record removed.';
          delete this.adminReviewNotes[submission.id];
          if (this.adminEditingSubmissionId === submission.id) {
            this.cancelAdminResourceEdit();
          }
          this.showDismissFlagModal = false;
          this.dismissFlagSubmissionTarget = null;
        },
        error: (err) => {
          this.adminFlaggedSubmissionDeletingId = null;
          this.adminSubmissionActionError = err?.error?.error || 'Could not remove this flag record.';
        },
      });
  }

  updateAdminSubmissionStatus(submission: AdminSubmissionRow, status: 'approved' | 'rejected'): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminSubmissionActionError = 'Admin session required.';
      return;
    }

    const reviewNotes = this.getAdminReviewNote(submission.id).trim();
    if (status === 'rejected' && !reviewNotes) {
      this.adminSubmissionActionError = 'Please add a review note before rejecting.';
      return;
    }

    this.adminSubmissionSavingId = submission.id;
    this.adminSubmissionActionMessage = '';
    this.adminSubmissionActionError = '';

    this.http
      .patch<AdminSubmissionRow>(
        `${this.apiBaseUrl}/admin/submissions/${submission.id}/status`,
        {
          status,
          reviewNotes: reviewNotes || null,
        },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (updated) => {
          this.adminSubmissions = this.adminSubmissions.map((item) =>
            item.id === submission.id ? { ...item, ...updated } : item
          );
          this.adminSubmissionSavingId = null;
          this.adminSubmissionActionMessage = `Submission ${status}.`;
          delete this.adminReviewNotes[submission.id];
        },
        error: (err) => {
          this.adminSubmissionSavingId = null;
          this.adminSubmissionActionError = err?.error?.error || 'Could not update submission status.';
        },
      });
  }

  openAdminResourceEditor(resource: Resource): void {
    this.adminEditingResourceId = resource.id;
    this.adminEditingSubmissionId = null;
    this.adminEditPanelCollapsed = false;
    this.adminEditError = '';
    this.adminEditSuccess = '';
    this.adminEditForm = {
      name: resource.name || '',
      address: resource.address || '',
      city: resource.city || '',
      state: resource.state || 'NJ',
      zipCode: resource.zip_code || '',
      phoneNumber: resource.phone_number || '',
      hoursOfOperation: resource.hours_of_operation || '',
      website: resource.website || '',
      isVerified: Boolean(resource.is_verified),
    };
  }

  cancelAdminResourceEdit(): void {
    this.adminEditingResourceId = null;
    this.adminEditingSubmissionId = null;
    this.adminEditPanelCollapsed = false;
    this.adminEditError = '';
    this.adminEditSuccess = '';
    this.isAdminSavingEdit = false;
  }

  toggleAdminEditPanelCollapsed(): void {
    this.adminEditPanelCollapsed = !this.adminEditPanelCollapsed;
  }

  getFlaggedSubmissionResourceId(submission: AdminSubmissionRow): string | null {
    const note = (submission.notes || '').trim();
    const match = note.match(/FLAGGED RESOURCE \(([0-9a-fA-F-]{36})\)/);
    return match ? match[1] : null;
  }

  getFlaggedSubmissionResource(submission: AdminSubmissionRow): Resource | null {
    const resourceId = this.getFlaggedSubmissionResourceId(submission);
    if (!resourceId) return null;
    return this.adminResources.find((item) => item.id === resourceId) || null;
  }

  openAdminFlaggedResourceEditor(submission: AdminSubmissionRow, resource: Resource): void {
    this.openAdminResourceEditor(resource);
    this.adminEditingSubmissionId = submission.id;
  }

  submitFlaggedCorrection(submission: AdminSubmissionRow, resourceId: string): void {
    this.adminEditError = '';
    this.adminEditSuccess = '';
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminEditError = 'Admin session required.';
      return;
    }

    const name = this.adminEditForm.name.trim();
    const address = this.adminEditForm.address.trim();
    const zipCode = this.adminEditForm.zipCode.trim();
    if (name.length < 2) {
      this.adminEditError = 'Resource name must be at least 2 characters.';
      return;
    }
    if (address.length < 4) {
      this.adminEditError = 'Address must be at least 4 characters.';
      return;
    }
    if (!zipCode) {
      this.adminEditError = 'ZIP code is required.';
      return;
    }

    const payload = {
      name,
      address,
      city: this.adminEditForm.city.trim() || null,
      state: this.adminEditForm.state.trim() || 'NJ',
      zipCode,
      phoneNumber: this.adminEditForm.phoneNumber.trim() || null,
      hoursOfOperation: this.adminEditForm.hoursOfOperation.trim() || null,
      website: this.adminEditForm.website.trim() || null,
      isVerified: this.adminEditForm.isVerified,
    };

    this.isAdminSavingEdit = true;
    this.http
      .patch(`${this.apiBaseUrl}/admin/resources/${resourceId}`, payload, { headers: this.getAuthHeaders() })
      .subscribe({
        next: () => {
          this.isAdminSavingEdit = false;
          this.adminEditSuccess = 'Resource corrected in database.';
          this.loadAdminResources();
          if (!this.getAdminReviewNote(submission.id).trim()) {
            this.setAdminReviewNote(submission.id, 'Corrected by admin.');
          }
          this.updateAdminSubmissionStatus(submission, 'approved');
          this.cancelAdminResourceEdit();
        },
        error: (err) => {
          this.isAdminSavingEdit = false;
          this.adminEditError = err?.error?.error || 'Could not update resource right now.';
        },
      });
  }

  submitAdminResourceEdit(resourceId: string): void {
    this.adminEditError = '';
    this.adminEditSuccess = '';

    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminEditError = 'Admin session required.';
      return;
    }

    const name = this.adminEditForm.name.trim();
    const address = this.adminEditForm.address.trim();
    const zipCode = this.adminEditForm.zipCode.trim();
    if (name.length < 2) {
      this.adminEditError = 'Resource name must be at least 2 characters.';
      return;
    }
    if (address.length < 4) {
      this.adminEditError = 'Address must be at least 4 characters.';
      return;
    }
    if (!zipCode) {
      this.adminEditError = 'ZIP code is required.';
      return;
    }

    const payload = {
      name,
      address,
      city: this.adminEditForm.city.trim() || null,
      state: this.adminEditForm.state.trim() || 'NJ',
      zipCode,
      phoneNumber: this.adminEditForm.phoneNumber.trim() || null,
      hoursOfOperation: this.adminEditForm.hoursOfOperation.trim() || null,
      website: this.adminEditForm.website.trim() || null,
      isVerified: this.adminEditForm.isVerified,
    };

    this.isAdminSavingEdit = true;
    this.http
      .patch(`${this.apiBaseUrl}/admin/resources/${resourceId}`, payload, { headers: this.getAuthHeaders() })
      .subscribe({
        next: () => {
          this.isAdminSavingEdit = false;
          this.adminEditSuccess = 'Resource updated in database.';
          this.loadAdminResources();
        },
        error: (err) => {
          this.isAdminSavingEdit = false;
          this.adminEditError = err?.error?.error || 'Could not update resource right now.';
        },
      });
  }

  private filterAdminResourcesByZipCategory(zip: string, category: AdminZipCategoryKey): Resource[] {
    return this.adminResources.filter((resource) => {
      const sameZip = (resource.zip_code || '').trim() === zip;
      if (!sameZip) return false;
      if (category === 'all') return true;
      return (resource.category_name || '').toLowerCase() === category;
    });
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
    this.showZipResourceRequestPrompt = false;
    this.zipResourceRequestDecision = '';
    this.zipResourceRequestError = '';
    this.zipResourceRequestSuccess = '';
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
          this.showZipResourceRequestPrompt = rows.length === 0;
        },
        error: () => {
          this.isLoading = false;
          this.authMessage = 'Could not load resources right now. Please try again.';
        },
      });
  }

  setZipResourceRequestDecision(decision: 'yes' | 'no'): void {
    this.zipResourceRequestDecision = decision;
    this.zipResourceRequestError = '';
    this.zipResourceRequestSuccess = '';
  }

  dismissZipResourceRequestPrompt(): void {
    this.showZipResourceRequestPrompt = false;
    this.zipResourceRequestDecision = '';
    this.zipResourceRequestError = '';
    this.zipResourceRequestSuccess = '';
  }

  submitZipResourceRequestFromSearch(): void {
    this.zipResourceRequestError = '';
    this.zipResourceRequestSuccess = '';

    if (this.zipResourceRequestDecision !== 'yes') {
      this.zipResourceRequestError = 'Choose Yes to submit a request.';
      return;
    }

    const area = (this.lastSearchTerm || this.searchInput || '').trim();
    if (!area) {
      this.zipResourceRequestError = 'Search ZIP/city first.';
      return;
    }

    const zipMatch = area.match(/\b\d{5}\b/);
    if (!zipMatch) {
      this.zipResourceRequestError = 'Use a 5-digit US ZIP code in your search to request resources.';
      return;
    }
    const zipLabel = zipMatch[0];

    if (this.zipRequestOccupiesSlot(zipLabel)) {
      this.zipResourceRequestError = `A request for ZIP ${zipLabel} was already submitted.`;
      return;
    }

    const submittedAt = new Date().toISOString();
    const note = `Requested all resource types for ZIP ${zipLabel}.`;
    const requestOptions = this.currentUser && this.authToken ? { headers: this.getAuthHeaders() } : {};
    this.http
      .post<{ submission?: { id?: string; status?: 'pending' | 'approved' | 'rejected'; created_at?: string } }>(
        `${this.apiBaseUrl}/submissions`,
        {
          zipOrCity: zipLabel,
          categoryId: 6,
          resourceName: `For ZIP ${zipLabel}`,
          notes: note,
        },
        requestOptions
      )
      .subscribe({
        next: (response) => {
          const item: UpdateRequestItem = {
            id: response.submission?.id || `zipsearch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            resource: {
              id: `zipsearch-resource-${Date.now()}`,
              name: `For ZIP ${zipLabel}`,
              address: `Requested service area ${area}`,
              city: null,
              state: 'NJ',
              zip_code: zipLabel,
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
          this.zipResourceRequestSuccess = 'Request submitted and added to Zip/City Requests.';
          this.zipResourceRequestDecision = '';
          this.showZipResourceRequestPrompt = false;
        },
        error: (err) => {
          this.zipResourceRequestError =
            err?.error?.error || 'Could not submit ZIP request right now. Please try again.';
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

  dismissDashboardNotification(notificationId: string, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!notificationId || !this.currentUser?.id) return;
    this.dismissedNotificationIds.add(notificationId);
    this.persistDismissedNotificationIds();
    this.dashboardNotifications = this.dashboardNotifications.filter((item) => item.id !== notificationId);
  }

  openDashboardFlaggedResources(): void {
    this.dashboardTab = 'flagged';
    this.authMessage = '';
    this.refreshMySubmissionsFromServer();
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
    this.refreshMySubmissionsFromServer();
  }

  openDashboardMessages(): void {
    this.dashboardTab = 'messages';
    this.authMessage = '';
    this.userMessageError = '';
    this.userMessageSuccess = '';
    this.userStaffThreadExpanded = false;
    this.loadUserAdminMessages();
  }

  expandUserStaffThread(): void {
    if (this.isLoadingUserMessages) return;
    this.userStaffThreadExpanded = true;
    this.userMessageError = '';
    this.userMessageSuccess = '';
    this.markStaffThreadReadThroughLatest();
  }

  collapseUserStaffThread(): void {
    this.userStaffThreadExpanded = false;
    this.userMessageError = '';
    this.userMessageSuccess = '';
  }

  get userStaffCollapsedTitle(): string {
    if (this.userThreadArchivedByStaff) {
      return 'Conversation closed by staff';
    }
    return 'Staff messages';
  }

  /** Messages nav badge: staff messages newer than the last time the member opened the thread. */
  get userUnreadStaffMessageCount(): number {
    if (!this.currentUser || this.currentUser.role !== 'user') return 0;
    const lastReadMs = this.staffThreadLastReadAt
      ? new Date(this.staffThreadLastReadAt).getTime()
      : 0;
    return this.userAdminMessages.filter((m) => {
      if (m.sender_role !== 'admin') return false;
      const t = new Date(m.created_at).getTime();
      return !Number.isNaN(t) && t > lastReadMs;
    }).length;
  }

  get userStaffCollapsedDetail(): string {
    if (this.userThreadArchivedByStaff) {
      return 'Tap to view your messages or start a new conversation.';
    }
    if (this.userAdminMessages.length === 0) {
      return 'Tap to write to the team.';
    }
    const last = this.userAdminMessages[this.userAdminMessages.length - 1];
    const text = (last.body || '').trim().replace(/\s+/g, ' ');
    const snippet = text.length > 100 ? `${text.slice(0, 97)}…` : text;
    const who = this.isUserMessageFromMe(last) ? 'You' : (last.sender_name?.trim() || 'Staff');
    const when = this.formatChatDate(last.created_at);
    return `${who}: ${snippet} · ${when}`;
  }

  submitUserAdminMessage(): void {
    this.userMessageError = '';
    this.userMessageSuccess = '';
    const body = this.userMessageBody.trim();
    if (!body) {
      this.userMessageError = 'Please enter a message.';
      return;
    }
    if (!this.currentUser || !this.authToken || this.currentUser.role !== 'user') {
      this.userMessageError = 'You must be signed in as a member to send a message.';
      return;
    }
    this.isSendingUserMessage = true;
    this.http
      .post<{ message?: string }>(`${this.apiBaseUrl}/messages`, { body }, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (res) => {
          this.isSendingUserMessage = false;
          this.userMessageBody = '';
          this.userMessageSuccess = res.message || 'Message sent.';
          this.loadUserAdminMessages();
        },
        error: (err) => {
          this.isSendingUserMessage = false;
          this.userMessageError = err?.error?.error || 'Could not send your message right now.';
        },
      });
  }

  get adminMessageThreads(): AdminMessageThreadSummary[] {
    const map = new Map<string, AdminMessageThreadSummary>();
    for (const m of this.adminInboxMessages) {
      const id = m.thread_user_id;
      const label = this.getThreadMemberLabelFromRow(m);
      const cur = map.get(id);
      const t = new Date(m.created_at).getTime();
      if (!cur || t > new Date(cur.lastMessageAt).getTime()) {
        const preview = m.body.length > 100 ? `${m.body.slice(0, 97)}…` : m.body;
        map.set(id, { threadUserId: id, label, lastMessageAt: m.created_at, preview });
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  get adminSelectedThreadMessages(): AdminInboxMessageRow[] {
    if (!this.adminSelectedThreadUserId) return [];
    return this.adminInboxMessages.filter((m) => m.thread_user_id === this.adminSelectedThreadUserId);
  }

  getThreadMemberLabelFromRow(m: AdminInboxMessageRow): string {
    const name = `${m.thread_user_first_name || ''} ${m.thread_user_last_name || ''}`.trim();
    return name || m.thread_user_email || 'Member';
  }

  getAdminMessageBubbleLabel(row: AdminInboxMessageRow): string {
    if (row.sender_role === 'admin') {
      return row.sender_name?.trim() || 'Staff';
    }
    return row.sender_name?.trim() || row.thread_user_email || 'Member';
  }

  isUserMessageFromMe(msg: UserAdminMessage): boolean {
    return !!this.currentUser?.id && msg.sender_user_id === this.currentUser.id;
  }

  get showUserStaffMessageCompose(): boolean {
    return !this.userThreadArchivedByStaff || this.userChoseContinueStaffChat;
  }

  beginNewStaffMessage(): void {
    this.userChoseContinueStaffChat = true;
    this.userMessageError = '';
    this.userMessageSuccess = '';
  }

  selectAdminMessageThread(threadUserId: string): void {
    this.adminSelectedThreadUserId = threadUserId;
    this.adminReplyError = '';
    this.adminReplySuccess = '';
    this.adminArchiveThreadError = '';
  }

  setAdminMessagesScope(scope: 'active' | 'archived'): void {
    if (this.adminMessagesScope === scope) return;
    this.adminMessagesScope = scope;
    this.adminSelectedThreadUserId = null;
    this.adminArchiveThreadError = '';
    this.adminMessagesLoadError = '';
    this.loadAdminInboxMessages();
  }

  archiveAdminMessageThread(): void {
    this.adminArchiveThreadError = '';
    const threadUserId = this.adminSelectedThreadUserId;
    if (!threadUserId) {
      this.adminArchiveThreadError = 'Select a conversation first.';
      return;
    }
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminArchiveThreadError = 'Admin session required.';
      return;
    }
    this.isArchivingAdminThread = true;
    this.http
      .post<{ message?: string }>(
        `${this.apiBaseUrl}/admin/messages/archive`,
        { threadUserId },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: () => {
          this.isArchivingAdminThread = false;
          this.adminSelectedThreadUserId = null;
          this.refreshAdminActiveInboxCount();
          this.loadAdminInboxMessages();
        },
        error: (err) => {
          this.isArchivingAdminThread = false;
          this.adminArchiveThreadError = err?.error?.error || 'Could not archive this conversation.';
        },
      });
  }

  unarchiveAdminMessageThread(): void {
    this.adminArchiveThreadError = '';
    const threadUserId = this.adminSelectedThreadUserId;
    if (!threadUserId) {
      this.adminArchiveThreadError = 'Select a conversation first.';
      return;
    }
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminArchiveThreadError = 'Admin session required.';
      return;
    }
    this.isArchivingAdminThread = true;
    this.http
      .post<{ message?: string }>(
        `${this.apiBaseUrl}/admin/messages/unarchive`,
        { threadUserId },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: () => {
          this.isArchivingAdminThread = false;
          this.adminSelectedThreadUserId = null;
          this.refreshAdminActiveInboxCount();
          this.loadAdminInboxMessages();
        },
        error: (err) => {
          this.isArchivingAdminThread = false;
          this.adminArchiveThreadError = err?.error?.error || 'Could not restore this conversation.';
        },
      });
  }

  submitAdminThreadReply(): void {
    this.adminReplyError = '';
    this.adminReplySuccess = '';
    const text = this.adminReplyBody.trim();
    if (!this.adminSelectedThreadUserId) {
      this.adminReplyError = 'Select a conversation from the list.';
      return;
    }
    if (!text) {
      this.adminReplyError = 'Enter a reply.';
      return;
    }
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminReplyError = 'Admin session required.';
      return;
    }
    this.isSendingAdminReply = true;
    this.http
      .post<{ message?: string }>(
        `${this.apiBaseUrl}/admin/messages`,
        { threadUserId: this.adminSelectedThreadUserId, body: text },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (res) => {
          this.isSendingAdminReply = false;
          this.adminReplyBody = '';
          this.adminReplySuccess = res.message || 'Reply sent.';
          this.loadAdminInboxMessages();
        },
        error: (err) => {
          this.isSendingAdminReply = false;
          this.adminReplyError = err?.error?.error || 'Could not send reply.';
        },
      });
  }

  private pickLatestThreadUserId(rows: AdminInboxMessageRow[]): string | null {
    let latest: { id: string; t: number } | null = null;
    for (const m of rows) {
      const t = new Date(m.created_at).getTime();
      if (!latest || t > latest.t) {
        latest = { id: m.thread_user_id, t };
      }
    }
    return latest?.id ?? null;
  }

  getAdminSubmissionHandledLine(sub: AdminSubmissionRow): string | null {
    if (sub.status === 'pending' || !sub.reviewed_at) {
      return null;
    }
    const who = this.formatReviewerDisplayName(sub.reviewer_name, sub.reviewer_email);
    const when = this.formatChatDate(sub.reviewed_at);
    const verb = sub.status === 'approved' ? 'Handled' : 'Declined';
    return `${verb} by ${who} on ${when}.`;
  }

  getDeleteModalSub(): string {
    return 'Please enter your password to confirm. This action cannot be undone.';
  }

  getDeleteModalWarning(): string {
    if (this.currentUser?.role === 'admin') {
      return 'Deleting your administrator account will remove your login. Ensure another admin exists if the site should stay manageable.';
    }
    return 'Deleting your account will remove saved resources, flagged items, and account data.';
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

  /** Count of notifications currently shown (matches list length; respects dismissed items). */
  get notificationCount(): number {
    return this.dashboardNotifications.length;
  }

  get userZipUpdateRequests(): UpdateRequestItem[] {
    return this.updateRequests.filter((item) => {
      if (!this.isZipOnlyUpdateRequest(item)) return false;
      if (this.userZipRequestArchivedViewIds.has(item.id)) return false;
      return true;
    });
  }

  /** Sidebar badge: pending ZIP requests only (reviewed/declined/archived-from-view excluded). */
  get userPendingZipUpdateRequestCount(): number {
    return this.userZipUpdateRequests.filter((item) => item.status === 'pending').length;
  }

  /** Sidebar badge: flags still awaiting admin review (corrected/declined excluded). */
  get userPendingFlaggedResourceCount(): number {
    return this.flaggedResources.filter((item) => !item.status || item.status === 'pending').length;
  }

  saveAccountSettings(): void {
    this.settingsError = '';
    this.settingsSuccess = '';

    const email = (this.currentUser?.email || this.settingsEmail).trim().toLowerCase();

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
          this.settingsEmail = response.user.email;
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
            localStorage.removeItem(`crf_zip_req_archived_${this.currentUser.id}`);
            localStorage.removeItem(`crf_staff_thread_last_read_${this.currentUser.id}`);
            localStorage.removeItem(`crf_dismissed_notifications_${this.currentUser.id}`);
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

  cancelUpdateRequest(requestId: string): void {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId
    );

    if (this.currentUser && this.authToken && isUuid) {
      this.updateRequestError = '';
      this.updateRequestSuccess = '';
      this.http
        .delete<{ message?: string }>(`${this.apiBaseUrl}/submissions/${requestId}`, {
          headers: this.getAuthHeaders(),
        })
        .subscribe({
          next: (response) => {
            this.updateRequests = this.updateRequests.filter((item) => item.id !== requestId);
            this.persistUpdateRequests();
            this.updateRequestSuccess = response.message || 'Request cancelled.';
          },
          error: (err) => {
            if (err?.status === 404) {
              this.updateRequests = this.updateRequests.filter((item) => item.id !== requestId);
              this.persistUpdateRequests();
              return;
            }
            this.updateRequestError = err?.error?.error || 'Could not cancel request.';
          },
        });
      return;
    }

    this.updateRequests = this.updateRequests.filter((item) => item.id !== requestId);
    this.persistUpdateRequests();
  }

  submitZipUpdateRequest(): void {
    this.updateRequestError = '';
    this.updateRequestSuccess = '';

    const zip = this.updateRequestZip.trim();

    if (!/^\d{5}$/.test(zip)) {
      this.updateRequestError = 'Enter a valid 5-digit US ZIP code.';
      return;
    }
    if (this.zipRequestOccupiesSlot(zip)) {
      this.updateRequestError = `A request for ZIP ${zip} was already submitted.`;
      return;
    }

    const submittedAt = new Date().toISOString();
    const note = `Requested all resource types for ZIP ${zip}.`;
    const requestOptions = this.currentUser && this.authToken ? { headers: this.getAuthHeaders() } : {};
    this.http
      .post<{ submission?: { id?: string; status?: 'pending' | 'approved' | 'rejected'; created_at?: string } }>(
        `${this.apiBaseUrl}/submissions`,
        {
          zipOrCity: zip,
          categoryId: 6,
          resourceName: `For ZIP ${zip}`,
          notes: note,
        },
        requestOptions
      )
      .subscribe({
        next: (response) => {
          const item: UpdateRequestItem = {
            id: response.submission?.id || `zipreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            resource: {
              id: `zip-resource-${Date.now()}`,
              name: `For ZIP ${zip}`,
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
        },
        error: (err) => {
          this.updateRequestError =
            err?.error?.error || 'Could not submit ZIP request right now. Please try again.';
        },
      });
  }

  /** Blocks submitting another ZIP request for the same ZIP while one is active on the dashboard. */
  private zipRequestOccupiesSlot(zip: string): boolean {
    const z = zip.trim();
    return this.updateRequests.some((item) => {
      if (!this.isZipOnlyUpdateRequest(item)) return false;
      const itemZip = (item.resource?.zip_code || '').trim();
      if (itemZip !== z) return false;
      if (this.userZipRequestArchivedViewIds.has(item.id)) return false;
      return true;
    });
  }

  archiveUserZipRequestFromDashboard(item: UpdateRequestItem): void {
    if (item.status !== 'reviewed' && item.status !== 'declined') return;
    this.userZipRequestArchivedViewIds.add(item.id);
    this.persistZipRequestArchivedViewIds();
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
          if (returnedRole === 'admin') {
            this.openAdminDashboard();
          } else {
            this.viewMode = 'userDashboard';
          }
          this.loadDashboardNotifications();
          if (returnedRole === 'user') {
            this.loadUserAdminMessages();
            this.refreshMySubmissionsFromServer();
          }
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
          this.loadDashboardNotifications();
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
    this.suggestionForm.categoryId = null;
  }

  submitSuggestion(): void {
    this.submissionError = '';
    this.submissionSuccess = '';

    if (!this.suggestionForm.zipOrCity.trim()) {
      this.submissionError = 'Please enter zip code/city for the suggestion.';
      return;
    }

    const suggestLoc = this.suggestionForm.zipOrCity.trim();
    if (/^\d+$/.test(suggestLoc) && !/^(\d{5})(-\d{4})?$/.test(suggestLoc)) {
      this.submissionError =
        'Use a valid 5-digit U.S. ZIP code (you can use ZIP+4 as 12345-6789) or enter a city name instead.';
      return;
    }

    this.isSubmittingSuggestion = true;
    this.http
      .post<{ message: string }>(`${this.apiBaseUrl}/submissions`, {
        zipOrCity: this.suggestionForm.zipOrCity.trim(),
        categoryId: null,
        notes: this.suggestionForm.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.isSubmittingSuggestion = false;
          this.submissionSuccess = 'Suggestion sent. Admin will review it.';
          this.suggestionForm = {
            zipOrCity: this.lastSearchTerm || this.suggestionForm.zipOrCity,
            categoryId: null,
            notes: '',
          };
        },
        error: (err) => {
          this.isSubmittingSuggestion = false;
          const details = err?.error?.details;
          const firstDetail =
            Array.isArray(details) && details.length > 0 ? String(details[0].msg || details[0] || '') : '';
          this.submissionError =
            err?.error?.error ||
            firstDetail ||
            'Could not submit suggestion right now. Please try again.';
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
      tags.push({ label: 'Resource Verified', className: 'tag-verified' });
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
          next: () => this.loadDashboardNotifications(),
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
        next: () => this.loadDashboardNotifications(),
        error: () => {
          this.authMessage = 'Could not save to account. Local save still worked.';
        },
      });
  }

  openFlagResource(resourceId: string): void {
    this.flaggingResourceId = resourceId;
    this.flagReason = '';
    this.guestFlagContact = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  cancelFlagResource(): void {
    this.flaggingResourceId = null;
    this.flagReason = '';
    this.guestFlagContact = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  submitFlagResource(resource: Resource): void {
    this.flagError = '';
    this.flagSuccess = '';

    if (this.currentUser?.role === 'admin') {
      this.flagError = 'Use the admin dashboard to correct listings.';
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
    const notes = this.currentUser
      ? `FLAGGED RESOURCE (${resource.id}) by ${this.currentUser.email}: ${reason}`
      : `FLAGGED RESOURCE (${resource.id}) (guest): ${reason}`;

    const body: {
      zipOrCity: string;
      categoryId: number;
      resourceName: string;
      notes: string;
      submitterContact?: string;
    } = {
      zipOrCity,
      categoryId,
      resourceName: resource.name,
      notes,
    };

    if (!this.currentUser) {
      const contact = this.guestFlagContact.trim();
      if (contact) {
        body.submitterContact = contact.slice(0, 255);
      }
    }

    const requestOptions =
      this.currentUser && this.authToken ? { headers: this.getAuthHeaders() } : {};

    this.http
      .post<{ message: string; submission?: { id: string; status: 'pending' | 'approved' | 'rejected'; created_at: string } }>(
        `${this.apiBaseUrl}/submissions`,
        body,
        requestOptions
      )
      .subscribe({
        next: (response) => {
          const flaggedAt = new Date().toISOString();
          const flaggedItem: FlaggedResourceItem = {
            id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            resource: { ...resource },
            reason,
            flaggedAt,
            flaggedDateLabel: this.getFlaggedDateLabel(flaggedAt),
            submissionId: response.submission?.id,
            status: 'pending',
            statusLabel: 'Pending review',
          };
          this.flaggedResources = [flaggedItem, ...this.flaggedResources];
          this.persistFlaggedResources();

          this.flagSuccess = 'Flag sent for admin review. Thank you.';
          this.flagReason = '';
          this.guestFlagContact = '';
          this.flaggingResourceId = null;
          if (this.viewMode === 'userDashboard' && this.currentUser?.role === 'user') {
            this.dashboardTab = 'flagged';
          }
        },
        error: () => {
          this.flagError = 'Could not submit flag right now. Please try again.';
        },
      });
  }

  verifyResource(resource: Resource): void {
    this.verifyRequestError = '';
    this.verifyRequestSuccess = '';
    this.verifyRequestResourceId = resource.id;

    if (!this.currentUser) {
      this.verifyRequestError = 'Please log in as a user to verify resources.';
      return;
    }

    if (resource.is_verified) {
      this.verifyRequestSuccess = 'This resource is already verified.';
      return;
    }
    this.http
      .post<{ message?: string; isVerified?: boolean }>(
        `${this.apiBaseUrl}/resources/${resource.id}/verify`,
        {},
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (response) => {
          this.markResourceAsVerified(resource.id);
          this.verifyRequestSuccess = response.message || 'Resource verified.';
        },
        error: (err) => {
          this.verifyRequestError = err?.error?.error || 'Could not verify resource right now.';
        },
      });
  }

  private markResourceAsVerified(resourceId: string): void {
    const applyVerified = (item: Resource): Resource =>
      item.id === resourceId ? { ...item, is_verified: true } : item;

    this.allResults = this.allResults.map(applyVerified);
    this.filteredResults = this.filteredResults.map(applyVerified);
    this.savedResources = this.savedResources.map(applyVerified);
    this.adminResources = this.adminResources.map(applyVerified);
    this.adminSelectedResources = this.adminSelectedResources.map(applyVerified);
    this.persistSavedResources();
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
      this.flaggedResources = this.flaggedResources.map((item) => {
        const st = item.status;
        const status: FlaggedResourceItem['status'] =
          st === 'corrected' ? 'corrected' : st === 'declined' ? 'declined' : 'pending';
        let statusLabel = item.statusLabel;
        if (!statusLabel) {
          if (status === 'corrected') statusLabel = 'Corrected';
          else if (status === 'declined') statusLabel = 'Declined';
          else statusLabel = 'Pending review';
        }
        return {
          ...item,
          flaggedDateLabel: this.getFlaggedDateLabel(item.flaggedAt || new Date().toISOString()),
          status,
          statusLabel,
        };
      });
    } catch {
      this.flaggedResources = [];
    }
  }

  private formatReviewerDisplayName(name: string | null | undefined, email: string | null | undefined): string {
    const n = (name || '').trim();
    if (n) return n;
    const e = (email || '').trim();
    if (e) return e.includes('@') ? e.split('@')[0] : e;
    return 'Administrator';
  }

  private buildUserSubmissionHandledSummary(match: UserSubmissionStatusRow): string | null {
    if (match.status === 'pending') return null;
    const who = this.formatReviewerDisplayName(match.reviewer_name, match.reviewer_email);
    const when = this.formatChatDate(match.reviewed_at || match.updated_at);
    const verb = match.status === 'approved' ? 'Handled' : 'Declined';
    return `${verb} by ${who} on ${when}`;
  }

  private refreshMySubmissionsFromServer(): void {
    if (!this.currentUser || !this.authToken || this.currentUser.role !== 'user') return;

    this.http
      .get<UserSubmissionStatusRow[]>(`${this.apiBaseUrl}/submissions/mine`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          const byId = new Map(rows.map((row) => [row.id, row]));
          const correctedResourceIds = new Set<string>();
          let flaggedChanged = false;
          this.flaggedResources = this.flaggedResources.map((item) => {
            if (!item.submissionId) return item;
            const match = byId.get(item.submissionId);
            if (!match || match.submission_kind !== 'flag') return item;
            const handled = this.buildUserSubmissionHandledSummary(match);
            if (match.status === 'approved') {
              if (item.resource?.id) correctedResourceIds.add(item.resource.id);
              const nextLabel = handled ? `Corrected · ${handled}` : `Corrected ${this.getFlaggedDateLabel(match.updated_at)}`;
              const next: FlaggedResourceItem = {
                ...item,
                status: 'corrected',
                statusLabel: nextLabel,
                handledSummary: handled || undefined,
                adminReviewNote: match.review_notes || undefined,
              };
              if (
                item.status !== next.status ||
                item.statusLabel !== next.statusLabel ||
                item.handledSummary !== next.handledSummary ||
                item.adminReviewNote !== next.adminReviewNote
              ) {
                flaggedChanged = true;
              }
              return next;
            }
            if (match.status === 'rejected') {
              const next: FlaggedResourceItem = {
                ...item,
                status: 'declined',
                statusLabel: 'Declined',
                handledSummary: handled || undefined,
                adminReviewNote: match.review_notes || undefined,
              };
              if (item.status !== next.status || item.handledSummary !== next.handledSummary) {
                flaggedChanged = true;
              }
              return next;
            }
            const next: FlaggedResourceItem = {
              ...item,
              status: 'pending',
              statusLabel: 'Pending review',
              handledSummary: undefined,
              adminReviewNote: undefined,
            };
            if (item.status !== 'pending' || item.handledSummary || item.adminReviewNote) {
              flaggedChanged = true;
            }
            return next;
          });

          let zipChanged = false;
          this.updateRequests = this.updateRequests.filter((item) => {
            const match = byId.get(item.id);
            if (!this.isZipOnlyUpdateRequest(item)) return true;
            if (match?.submission_kind === 'zip_request' && match.status === 'cancelled') {
              zipChanged = true;
              return false;
            }
            return true;
          });

          this.updateRequests = this.updateRequests.map((item) => {
            const match = byId.get(item.id);
            if (!match || match.submission_kind !== 'zip_request') return item;
            const handled = this.buildUserSubmissionHandledSummary(match);
            if (match.status === 'pending') {
              const next: UpdateRequestItem = {
                ...item,
                status: 'pending',
                handledSummary: undefined,
                adminReviewNote: undefined,
              };
              if (
                item.status !== 'pending' ||
                item.handledSummary !== undefined ||
                (item.adminReviewNote !== undefined && item.adminReviewNote !== null)
              ) {
                zipChanged = true;
              }
              return next;
            }
            if (match.status === 'approved') {
              const next: UpdateRequestItem = {
                ...item,
                status: 'reviewed',
                handledSummary: handled || undefined,
                adminReviewNote: match.review_notes || undefined,
              };
              if (item.status !== 'reviewed' || item.handledSummary !== next.handledSummary) zipChanged = true;
              return next;
            }
            if (match.status === 'rejected') {
              const next: UpdateRequestItem = {
                ...item,
                status: 'declined',
                handledSummary: handled || undefined,
                adminReviewNote: match.review_notes || undefined,
              };
              if (item.status !== 'declined' || item.handledSummary !== next.handledSummary) zipChanged = true;
              return next;
            }
            return item;
          });

          if (flaggedChanged) {
            this.persistFlaggedResources();
          }
          if (zipChanged) {
            this.persistUpdateRequests();
          }
          if (correctedResourceIds.size > 0) {
            this.refreshFlaggedResourceDetails(Array.from(correctedResourceIds));
          }
        },
      });
  }

  private refreshFlaggedResourceDetails(resourceIds: string[]): void {
    resourceIds.forEach((resourceId) => {
      this.http
        .get<Resource>(`${this.apiBaseUrl}/resources/${resourceId}`)
        .subscribe({
          next: (latest) => {
            let updated = false;
            this.flaggedResources = this.flaggedResources.map((item) => {
              if (!item.resource || item.resource.id !== resourceId) return item;
              updated = true;
              return {
                ...item,
                resource: {
                  ...item.resource,
                  ...latest,
                },
              };
            });
            if (updated) {
              this.persistFlaggedResources();
            }
          },
        });
    });
  }

  private isZipOnlyUpdateRequest(item: UpdateRequestItem): boolean {
    const zip = (item.resource?.zip_code || '').trim();
    if (!/^\d{5}$/.test(zip)) return false;
    const label = (item.resource?.name || '').trim();
    return label.startsWith('For ZIP ');
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
      this.dismissedNotificationIds.clear();
      this.userZipRequestArchivedViewIds.clear();
      this.staffThreadLastReadAt = null;
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as AuthUser;
      this.currentUser = parsed;
      this.authToken = token;
      this.loadDismissedNotificationIdsFromStorage();
      this.loadZipRequestArchivedViewIds();
      if (parsed.role !== 'admin') {
        this.loadStaffThreadLastReadFromStorage();
      } else {
        this.staffThreadLastReadAt = null;
      }
    } catch {
      this.currentUser = null;
      this.authToken = '';
      this.dismissedNotificationIds.clear();
      this.userZipRequestArchivedViewIds.clear();
      this.staffThreadLastReadAt = null;
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
    this.dismissedNotificationIds.clear();
    this.userZipRequestArchivedViewIds.clear();
    this.staffThreadLastReadAt = null;
    this.userAdminMessages = [];
    this.userThreadArchivedByStaff = false;
    this.userChoseContinueStaffChat = false;
    this.userStaffThreadExpanded = false;
    this.adminInboxMessages = [];
    this.adminMessagesActiveThreadCount = 0;
    this.adminMessagesScope = 'active';
    this.adminMessagesLoadError = '';
    this.adminSelectedThreadUserId = null;
    this.adminReplyBody = '';
    this.adminReplyError = '';
    this.adminReplySuccess = '';
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

    this.loadDismissedNotificationIdsFromStorage();

    this.http
      .get<ApiNotificationRow[]>(`${this.apiBaseUrl}/notifications`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          this.dashboardNotifications = rows.reduce<NotificationItem[]>((acc, row, index) => {
            const id = this.stableNotificationIdFromRow(row, index);
            if (this.dismissedNotificationIds.has(id)) {
              return acc;
            }
            const category = this.normalizeNotificationCategory(row.category_name);
            const actionText = this.getNotificationActionLabel(row.action);
            const locationBits = [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(', ');
            const baseDetails = locationBits
              ? `${actionText} in database for ${row.resource_name}. Location: ${locationBits}.`
              : `${actionText} in database for ${row.resource_name}.`;
            const changeSummary = this.formatNotificationChangeSummary(row.action, row.changes);
            const details = changeSummary ? `${baseDetails} ${changeSummary}` : baseDetails;

            acc.push({
              id,
              title: `${row.resource_name} was ${row.action}`,
              details,
              category,
              dateLabel: this.getFlaggedDateLabel(row.created_at),
              isUnread: false,
            });
            return acc;
          }, []);
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

  private getDismissedNotificationsStorageKey(): string | null {
    const userId = this.currentUser?.id;
    return userId ? `crf_dismissed_notifications_${userId}` : null;
  }

  private loadDismissedNotificationIdsFromStorage(): void {
    this.dismissedNotificationIds.clear();
    const key = this.getDismissedNotificationsStorageKey();
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        if (typeof item === 'string' && item.length > 0) {
          this.dismissedNotificationIds.add(item);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persistDismissedNotificationIds(): void {
    const key = this.getDismissedNotificationsStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify([...this.dismissedNotificationIds]));
  }

  private stableNotificationIdFromRow(row: ApiNotificationRow, index: number): string {
    return row.notification_id || `${row.resource_id}-${row.created_at}-${index}`;
  }

  private formatNotificationChangeSummary(action: string, changes: Record<string, unknown> | null | undefined): string {
    if (!changes || typeof changes !== 'object') {
      return '';
    }

    if (action === 'verified') {
      return 'Detail: this listing is now marked verified in the database.';
    }

    const source = changes['source'];
    if (source === 'zip_import') {
      const zip = typeof changes['zipCode'] === 'string' ? changes['zipCode'].trim() : '';
      if (action === 'created') {
        return zip
          ? `Detail: added from a directory import for ZIP ${zip}.`
          : 'Detail: added from a community directory import.';
      }
      return zip
        ? `Detail: listing fields were refreshed from a directory import for ZIP ${zip}.`
        : 'Detail: listing fields were refreshed from a community directory import.';
    }

    if (action === 'created' && changes['after'] && typeof changes['after'] === 'object') {
      const snapshot = this.summarizeResourceRowForNotification(changes['after'] as Record<string, unknown>);
      return snapshot ? `Detail: ${snapshot}` : '';
    }

    if (action === 'updated' && changes['before'] && changes['after']) {
      const diff = this.formatResourceFieldDiffs(
        changes['before'] as Record<string, unknown>,
        changes['after'] as Record<string, unknown>
      );
      return diff ? `Detail: ${diff}` : 'Detail: one or more fields on this listing were updated.';
    }

    return '';
  }

  private summarizeResourceRowForNotification(row: Record<string, unknown>): string {
    const keys = ['name', 'address', 'city', 'state', 'zip_code', 'phone_number', 'hours_of_operation', 'website'] as const;
    const parts: string[] = [];
    for (const key of keys) {
      const raw = row[key];
      if (raw === null || raw === undefined) continue;
      const s = String(raw).trim();
      if (!s) continue;
      const label = this.resourceFieldLabel(key);
      parts.push(`${label}: ${this.truncateNotificationText(s)}`);
    }
    return parts.join('; ');
  }

  private formatResourceFieldDiffs(before: Record<string, unknown>, after: Record<string, unknown>): string {
    const tracked = [
      'name',
      'description',
      'address',
      'city',
      'state',
      'zip_code',
      'phone_number',
      'hours_of_operation',
      'website',
      'requirements',
      'category_id',
      'is_verified',
    ] as const;
    const parts: string[] = [];
    for (const key of tracked) {
      const b = before[key];
      const a = after[key];
      if (this.valuesEqualForAudit(b, a)) continue;
      const label = this.resourceFieldLabel(key);
      if (key === 'category_id') {
        parts.push(
          `${label}: ${this.formatCategoryIdForNotification(b)} → ${this.formatCategoryIdForNotification(a)}`
        );
        continue;
      }
      parts.push(
        `${label}: ${this.formatNotificationFieldValue(b)} → ${this.formatNotificationFieldValue(a)}`
      );
    }
    return parts.length ? `Updated fields — ${parts.join('; ')}` : '';
  }

  private resourceFieldLabel(key: string): string {
    const map: Record<string, string> = {
      name: 'Name',
      description: 'Description',
      address: 'Address',
      city: 'City',
      state: 'State',
      zip_code: 'ZIP',
      phone_number: 'Phone',
      hours_of_operation: 'Hours',
      website: 'Website',
      requirements: 'Requirements / eligibility',
      category_id: 'Category',
      is_verified: 'Verified',
    };
    return map[key] || key;
  }

  private valuesEqualForAudit(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private formatNotificationFieldValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    const s = String(val).trim();
    if (!s) return '—';
    return this.truncateNotificationText(s);
  }

  private formatCategoryIdForNotification(val: unknown): string {
    if (val === null || val === undefined) return '—';
    const id = Number(val);
    if (Number.isNaN(id)) return this.formatNotificationFieldValue(val);
    const row = this.categories.find((c) => c.id === id);
    return row ? row.label : `Category #${id}`;
  }

  private truncateNotificationText(s: string, max = 200): string {
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
  }

  private loadAdminDashboardData(): void {
    this.loadAdminResources();
    this.loadAdminSubmissions();
    this.loadAdminUsers();
    this.refreshAdminActiveInboxCount();
  }

  private loadAdminResources(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      return;
    }

    this.isAdminLoading = true;
    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/admin/resources`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          this.adminResources = rows;
          this.adminZipRows = this.buildAdminZipRows(rows);
          if (this.adminSelectedZip) {
            this.adminSelectedResources = this.filterAdminResourcesByZipCategory(
              this.adminSelectedZip,
              this.adminSelectedCategoryKey
            );
          }
          this.isAdminLoading = false;
        },
        error: (err) => {
          this.adminResources = [];
          this.adminZipRows = [];
          this.isAdminLoading = false;
          this.adminDashboardError = err?.error?.error || 'Could not load admin resources right now.';
        },
      });
  }

  private loadAdminSubmissions(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      return;
    }

    this.http
      .get<AdminSubmissionRow[]>(`${this.apiBaseUrl}/admin/submissions`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          this.adminSubmissions = rows;
        },
        error: () => {
          this.adminSubmissions = [];
        },
      });
  }

  private loadAdminUsers(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      return;
    }

    this.http
      .get<AdminUserAccount[]>(`${this.apiBaseUrl}/admin/users`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (rows) => {
          this.adminUsers = rows;
        },
        error: (err) => {
          this.adminUsers = [];
          this.adminUserActionError = err?.error?.error || 'Could not load user accounts.';
        },
      });
  }

  private loadUserAdminMessages(): void {
    if (!this.currentUser || !this.authToken || this.currentUser.role !== 'user') {
      this.userAdminMessages = [];
      this.userThreadArchivedByStaff = false;
      this.userChoseContinueStaffChat = false;
      return;
    }

    this.isLoadingUserMessages = true;
    this.http
      .get<UserMessagesApiResponse | UserAdminMessage[]>(`${this.apiBaseUrl}/messages`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (data) => {
          if (Array.isArray(data)) {
            this.userAdminMessages = data;
            this.userThreadArchivedByStaff = false;
          } else {
            this.userAdminMessages = data.messages ?? [];
            this.userThreadArchivedByStaff = Boolean(data.threadArchivedByStaff);
          }
          if (!this.userThreadArchivedByStaff) {
            this.userChoseContinueStaffChat = false;
          }
          this.isLoadingUserMessages = false;
          if (this.userStaffThreadExpanded) {
            this.markStaffThreadReadThroughLatest();
          }
        },
        error: () => {
          this.userAdminMessages = [];
          this.userThreadArchivedByStaff = false;
          this.userChoseContinueStaffChat = false;
          this.isLoadingUserMessages = false;
        },
      });
  }

  private getStaffThreadLastReadKey(): string {
    if (!this.currentUser || this.currentUser.role !== 'user') return '';
    return `crf_staff_thread_last_read_${this.currentUser.id}`;
  }

  private loadStaffThreadLastReadFromStorage(): void {
    this.staffThreadLastReadAt = null;
    const key = this.getStaffThreadLastReadKey();
    if (!key) return;
    const raw = localStorage.getItem(key)?.trim();
    if (raw) this.staffThreadLastReadAt = raw;
  }

  /** Call when the member opens the conversation or reloads it while open — clears unread for current messages. */
  private markStaffThreadReadThroughLatest(): void {
    if (!this.currentUser || this.currentUser.role !== 'user') return;
    const key = this.getStaffThreadLastReadKey();
    if (!key) return;

    let latestMs = 0;
    for (const m of this.userAdminMessages) {
      const t = new Date(m.created_at).getTime();
      if (!Number.isNaN(t) && t > latestMs) latestMs = t;
    }
    const iso = latestMs > 0 ? new Date(latestMs).toISOString() : new Date().toISOString();
    this.staffThreadLastReadAt = iso;
    localStorage.setItem(key, iso);
  }

  private loadAdminAccountProfile(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminAccountProfile = null;
      return;
    }

    this.adminAccountProfileError = '';
    this.isLoadingAdminAccountProfile = true;
    this.http
      .get<AccountProfileResponse>(`${this.apiBaseUrl}/account`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (profile) => {
          this.adminAccountProfile = profile;
          this.isLoadingAdminAccountProfile = false;
        },
        error: (err) => {
          this.adminAccountProfile = null;
          this.isLoadingAdminAccountProfile = false;
          this.adminAccountProfileError = err?.error?.error || 'Could not load your account details.';
        },
      });
  }

  /** Fetches active-thread count for sidebar badge without changing the messages list. */
  private refreshAdminActiveInboxCount(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminMessagesActiveThreadCount = 0;
      return;
    }

    const params = new HttpParams().set('scope', 'active');
    this.http
      .get<AdminInboxMessageRow[]>(`${this.apiBaseUrl}/admin/messages`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .subscribe({
        next: (rows) => {
          this.adminMessagesActiveThreadCount = new Set(rows.map((r) => r.thread_user_id)).size;
        },
        error: () => {
          this.adminMessagesActiveThreadCount = 0;
        },
      });
  }

  private loadAdminInboxMessages(): void {
    if (!this.currentUser || this.currentUser.role !== 'admin' || !this.authToken) {
      this.adminInboxMessages = [];
      this.adminSelectedThreadUserId = null;
      return;
    }

    this.isLoadingAdminMessages = true;
    this.adminMessagesLoadError = '';
    const params = new HttpParams().set('scope', this.adminMessagesScope);
    this.http
      .get<AdminInboxMessageRow[]>(`${this.apiBaseUrl}/admin/messages`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .subscribe({
        next: (rows) => {
          this.adminInboxMessages = rows;
          this.isLoadingAdminMessages = false;
          this.adminMessagesLoadError = '';
          if (this.adminMessagesScope === 'active') {
            this.adminMessagesActiveThreadCount = new Set(rows.map((r) => r.thread_user_id)).size;
          }
          const sel = this.adminSelectedThreadUserId;
          if (sel && !rows.some((r) => r.thread_user_id === sel)) {
            this.adminSelectedThreadUserId = null;
          }
          if (!this.adminSelectedThreadUserId && rows.length > 0) {
            this.adminSelectedThreadUserId = this.pickLatestThreadUserId(rows);
          }
        },
        error: (err) => {
          this.adminInboxMessages = [];
          this.isLoadingAdminMessages = false;
          this.adminSelectedThreadUserId = null;
          this.adminMessagesLoadError =
            err?.error?.error || err?.message || 'Could not load messages. Try again or check the server logs.';
        },
      });
  }

  private buildAdminZipRows(resources: Resource[]): AdminZipSummaryRow[] {
    const zipMap = new Map<string, AdminZipSummaryRow>();

    resources.forEach((resource) => {
      const zip = (resource.zip_code || '').trim();
      if (!zip) return;

      const key = zip;
      const existing = zipMap.get(key) || {
        zip,
        city: resource.city || 'Unknown city',
        food: 0,
        health: 0,
        jobs: 0,
        housing: 0,
        legal: 0,
        government: 0,
        total: 0,
      };

      const category = (resource.category_name || '').toLowerCase();
      if (category === 'food') existing.food += 1;
      if (category === 'health') existing.health += 1;
      if (category === 'jobs') existing.jobs += 1;
      if (category === 'housing') existing.housing += 1;
      if (category === 'legal') existing.legal += 1;
      if (category === 'government') existing.government += 1;
      existing.total += 1;

      if (!existing.city && resource.city) {
        existing.city = resource.city;
      }

      zipMap.set(key, existing);
    });

    return Array.from(zipMap.values()).sort((a, b) => a.zip.localeCompare(b.zip));
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

  private getZipRequestArchivedViewKey(): string {
    if (!this.currentUser) return '';
    return `crf_zip_req_archived_${this.currentUser.id}`;
  }

  private loadZipRequestArchivedViewIds(): void {
    this.userZipRequestArchivedViewIds.clear();
    const key = this.getZipRequestArchivedViewKey();
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const id of parsed) {
        if (typeof id === 'string') this.userZipRequestArchivedViewIds.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  private persistZipRequestArchivedViewIds(): void {
    const key = this.getZipRequestArchivedViewKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify([...this.userZipRequestArchivedViewIds]));
  }

  getFlaggedDateLabel(isoDate: string): string {
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

  /** Month/day/year for admin Accounts (e.g. 04/27/2026). */
  formatAdminAccountDate(isoDate: string | null | undefined): string {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }

  /** Month/day/year for chat timestamps (member and admin). */
  formatChatDate(isoDate: string | null | undefined): string {
    return this.formatAdminAccountDate(isoDate);
  }
}
