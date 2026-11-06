const CACHE_KEY = 'user_data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms
const CACHE_VERSION = 5; // bump whenever the cached payload's shape changes
let userData = null; // Global variable to store user data

const PROFILE_CACHE_KEY = 'own_profile_data';

async function validateCacheAndGetUserData(forceFetch) {
    return new Promise((resolve) => {
        const cached = localStorage.getItem(CACHE_KEY);
        let userData = cached ? JSON.parse(cached) : null;

        const isCacheValid = userData && userData.cacheVersion === CACHE_VERSION && (Date.now() - userData.timestamp < CACHE_TTL);

        if (isCacheValid && !forceFetch) {
            // console.log("Using cached user data:", userData);
            handleUserData(userData);
            resolve(userData);
            return;
        }

        jQuery.ajax({
            url: window.ajaxurl || "/wp-admin/admin-ajax.php",
            type: 'GET',
            dataType: 'json',
            data: { action: 'l2mgm_logged' },
            success: function(resp) {
                let newUserData;

                if (resp.success) {
                    newUserData = {
                        user_id: resp.data?.user_id || null,
                        logged_in: true,
                        username: resp.data?.username || null,
                        avatar: resp.data?.avatar || null,
                        email: resp.data?.email || null,
                        balance: resp.data?.balance || 0,
                        referralBalance: resp.data?.referralBalance || 0,
                        energy: resp.data?.energy || 0,
                        level: resp.data?.level || 1,
                        levelProgress: resp.data?.levelProgress || 0,
                        membership_tier_name: resp.data?.membership_tier_name || null,
                        membership_tier_slug: resp.data?.membership_tier_slug || null,
                        discordConnected: resp.data?.discordConnected || false,
                        discordUsername: resp.data?.discordUsername || null,
                        timestamp: Date.now(),
                        twoFaActive: resp.data?.twoFaActive || null,
                    };
                    // console.log("User logged in:", newUserData);
                } else {
                    newUserData = {
                        logged_in: false,
                        username: null,
                        avatar: null,
                        email: null,
                        balance: null,
                        referralBalance: null,
                        energy: null,
                        level: null,
                        levelProgress: null,
                        membership_tier_name: null,
                        membership_tier_slug: null,
                        discordConnected: false,
                        discordUsername: null,
                        timestamp: Date.now(),
                        twoFaActive: null
                    };
                    // console.log("User not logged in");
                }

                updateUserData(newUserData);
                resolve(newUserData);
            },
            error: function() {
                // console.log("AJAX failed, assuming not logged in");
                const fallbackData = {
                    logged_in: false,
                    username: null,
                    avatar: null,
                    email: null,
                    balance: null,
                    referralBalance: null,
                    energy: null,
                    level: null,
                    levelProgress: null,
                    membership_tier_name: null,
                    membership_tier_slug: null,
                    timestamp: Date.now()
                };
                updateUserData(fallbackData);
                resolve(fallbackData);
            }
        });
    });
}

validateCacheAndGetUserData().then(data => {
    userData = data; // Assign fetched data to the global variable
});

function setLevelRing(wrapEl, level, progressPercent) {
    if (!wrapEl) return;
    const circle = wrapEl.querySelector('.ring-progress, .ring2-progress');
    const label = wrapEl.querySelector('.percentage');
    if (!circle || !label) return;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(100, Math.max(0, Number(progressPercent) || 0));

    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    label.textContent = level;
}

function updateOwnLevelRings(level, progressPercent) {
    document.querySelectorAll('.js_own_level_circle').forEach(wrap => setLevelRing(wrap, level, progressPercent));
}

function handleUserData(data) {
    if (data.logged_in) {
        document.querySelectorAll('.js_user_username').forEach(x => {
            x.textContent = data.username;
        });
        if (data.avatar) {
            document.querySelectorAll('.js_user_avatar').forEach(x => {
                x.src = data.avatar;
            });
        }
        document.querySelectorAll('.js_user_email').forEach(x => {
            x.textContent = data.email;
        });
        document.querySelectorAll('.js_user_balance').forEach(x => {
            x.textContent = data.balance;
        });
        document.querySelectorAll('.js_referral_balance').forEach(x => {
            x.textContent = data.referralBalance;
        });
        document.querySelectorAll('.js_user_energy').forEach(x => {
            // Older cached entries (localStorage, up to 5min TTL) predate these fields.
            x.textContent = data.energy ?? 0;
        });
        updateOwnLevelRings(data.level ?? 1, data.levelProgress ?? 0);
        if (data.membership_tier_slug) {
            const membershipIconBase = window.rebornThemeUri ? window.rebornThemeUri + '/images/icons/mmb_' : null;
            document.querySelectorAll('.js_club_membership_name').forEach(x => {
                x.textContent = data.membership_tier_name || 'Vassal';
            });
            if (membershipIconBase) {
                document.querySelectorAll('.js_club_membership_icon').forEach(x => {
                    x.src = membershipIconBase + data.membership_tier_slug + '.svg';
                });
            }
        }
        window.accountMenuSelector = 'popup2_account_list_loged';
        document.querySelectorAll('#mobile_menu_logged_in').forEach(el => el.style.display = 'flex');
        document.querySelectorAll('#mobile_menu_logged_out').forEach(el => el.style.display = 'none');
    } else {
        // $('.js_master_account').html("Welcome Guest");
        // $('.js_user_account_link').prop('href', '/signin/');
        // $('.js_user_email').html("Sign In / Sign Up");
        window.accountMenuSelector = 'popup_account_list_not_logged';
        document.querySelectorAll('#mobile_menu_logged_in').forEach(el => el.style.display = 'none');
        document.querySelectorAll('#mobile_menu_logged_out').forEach(el => el.style.display = 'flex');
    }
}

const NONCE_INFLIGHT = {};

function getNonce(nonce_name) {
    if (NONCE_INFLIGHT[nonce_name]) return NONCE_INFLIGHT[nonce_name];

    const request = new Promise((resolve, reject) => {
        if (!nonce_name) return reject("Missing nonce_name");

        jQuery.ajax({
            url: window.ajaxurl || "/wp-admin/admin-ajax.php",
            type: "POST",
            dataType: "json",
            data: {
                action: "l2mgm_nonce",
                nonce_name: nonce_name
            },
            success: function (resp) {
                if (resp.success && resp.data && resp.data.nonce) {
                    resolve(resp.data.nonce);
                } else {
                    reject(resp.data?.message || "Invalid response");
                }
            },
            error: function (xhr, status, error) {
                reject(error || "AJAX error");
            }
        });
    });

    NONCE_INFLIGHT[nonce_name] = request;
    const clear = function () { delete NONCE_INFLIGHT[nonce_name]; };
    request.then(clear, clear);
    return request;
}

function updateUserData(newData) {
    userData = { ...userData, ...newData, timestamp: Date.now(), cacheVersion: CACHE_VERSION };
    localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
    jQuery(function($) {
        handleUserData(userData);
    });
}


async function validateCacheAndGetProfileData(forceFetch) {
    return new Promise((resolve) => {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        const profileData = cached ? JSON.parse(cached) : null;

        const isCacheValid = profileData && profileData.cacheVersion === CACHE_VERSION && (Date.now() - profileData.timestamp < CACHE_TTL);

        if (isCacheValid && !forceFetch) {
            resolve(profileData);
            return;
        }

        getNonce('l2mgm-profile').then(nonce => {
            jQuery.ajax({
                url: window.ajaxurl || "/wp-admin/admin-ajax.php",
                type: 'GET',
                data: { action: 'l2mgm_profile_get', _wpnonce: nonce },
                success: function (resp) {
                    if (resp && resp.success) {
                        const newProfileData = Object.assign({}, resp.data, {
                            timestamp: Date.now(),
                            cacheVersion: CACHE_VERSION
                        });
                        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(newProfileData));
                        resolve(newProfileData);
                    } else {
                        console.error("Failed to load profile:", resp);
                        resolve(profileData || null);
                    }
                },
                error: function (xhr, status, error) {
                    console.error("AJAX error:", error);
                    resolve(profileData || null);
                }
            });
        }).catch(() => resolve(profileData || null));
    });
}

function invalidateOwnProfileCache() {
    localStorage.removeItem(PROFILE_CACHE_KEY);
}

function logout() {
    getNonce('l2mgm_logout')
        .then(nonce => {
            // console.log("Got nonce:", nonce);
            const redirectTo = '/';
            jQuery.ajax({
                url: window.ajaxurl || "/wp-admin/admin-ajax.php",
                type: "POST",
                dataType: "json",
                data: {
                    action: "l2mgm_logout",
                    nonce: nonce,
                    redirect_to: redirectTo

                },
                success: function (resp) {
                    if (resp && resp.success) {
                        localStorage.removeItem('user_data');
                        invalidateOwnProfileCache();
                        if (resp.data.redirect) {
                            window.location.href = resp.data.redirect;
                        } else {
                            window.location.reload();
                        }
                    } else {
                        console.error("Failed to logout:", resp);
                    }
                },
                error: function (xhr, status, error) {
                    console.error("Failed to logout:", err);
                }
            });
        })
        .catch(err => {
            console.error("Failed to get nonce:", err);
        });
}

function CopyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Modern, secure API
        navigator.clipboard.writeText(text).then(() => {
            // console.log('Copied to clipboard:', text);
        }).catch(err => {
            // console.error('Failed to copy:', err);
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';  // prevent scroll to bottom
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            // console.log('Copied to clipboard (fallback):', text);
        } catch (err) {
            // console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textarea);
    }
}
function cleanAccountName(account_name) {
    return String(account_name).replace(/[^a-zA-Z0-9_]/g, '_');
}