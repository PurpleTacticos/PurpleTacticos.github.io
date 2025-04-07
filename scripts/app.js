// scripts/app.js
document.addEventListener('DOMContentLoaded', function() {
    // Core Configuration
    const config = {
        maxImageSize: 2 * 1024 * 1024, // 2MB
        allowedImageTypes: ['image/jpeg', 'image/png']
    };

    // Supabase Client Configuration
    const SUPABASE_URL = 'https://zlgdklqjaomnlfteairf.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2RrbHFqYW9tbmxmdGVhaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjMxODQsImV4cCI6MjA1OTYzOTE4NH0.UlpTet57p8RZcmJ5ULf2TCFVG_rTubx7rLHRTHRFRn8';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State Management
    let votedArticles = JSON.parse(localStorage.getItem('voted')) || [];
    
    // Dark Mode Initialization
    const darkModeToggle = document.getElementById('darkModeToggle');
    const icon = darkModeToggle?.querySelector('i');

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error:', err));
    }

    // Dark Mode Functions
    function initializeDarkMode() {
        if (localStorage.getItem('darkMode') === 'light') {
            document.body.classList.add('light-mode');
            icon?.classList.replace('fa-moon', 'fa-sun');
        }
    }

    function toggleDarkMode() {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('darkMode', 
            document.body.classList.contains('light-mode') ? 'light' : 'dark'
        );
        icon?.classList.toggle('fa-moon');
        icon?.classList.toggle('fa-sun');
    }

    // Article Management
    function createArticleCard(article) {
        const safeContent = DOMPurify.sanitize(article.content.substring(0, 100));
        const isVoted = votedArticles.includes(article.id);
        
        return `
            <div class="article-card" data-id="${article.id}">
                ${article.image ? `<img src="${article.image}" class="article-image" alt="Take image">` : ''}
                ${article.xPostLink ? `<blockquote class="twitter-tweet"><a href="${DOMPurify.sanitize(article.xPostLink)}"></a></blockquote>` : ''}
                <div class="article-content">
                    <h3>${DOMPurify.sanitize(article.title)}</h3>
                    <p>${safeContent}...</p>
                    <div class="article-meta">
                        <span>${DOMPurify.sanitize(article.author)}</span>
                        <span>${new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="hot-take-meter ${isVoted ? 'voted' : ''}" 
                         data-article-id="${article.id}">
                        <div class="score-bar" style="width: ${article.hotTakeScore}%"></div>
                        <span class="hot-take-score">${article.hotTakeScore}%</span>
                    </div>
                    <button class="btn share-btn" onclick="shareArticle(${article.id})">📢 Share</button>
                </div>
            </div>
        `;
    }

    // Enhanced Voting System
    async function handleVote(articleId) {
        if (votedArticles.includes(articleId)) return;
        
        try {
            const { data: article, error } = await supabase
                .from('articles')
                .select('hotTakeScore')
                .eq('id', articleId)
                .single();

            if (error) throw error;

            const newScore = Math.min(article.hotTakeScore + 20, 100);
            const { error: updateError } = await supabase
                .from('articles')
                .update({ hotTakeScore: newScore })
                .eq('id', articleId);

            if (updateError) throw updateError;

            votedArticles.push(articleId);
            localStorage.setItem('voted', JSON.stringify(votedArticles));
            loadArticles();

        } catch (error) {
            console.error('Voting failed:', error);
            showToast('Failed to register vote. Try again!');
        }
    }

    // Article Loading System
    async function loadArticles() {
        try {
            const { data: articles, error } = await supabase
                .from('articles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const containers = {
                hotTakes: document.getElementById('hotTakes'),
                classicTakes: document.getElementById('classicTakes'),
                searchResults: document.getElementById('searchResults'),
                allTakes: document.getElementById('allTakes')
            };

            // Clear all containers
            Object.values(containers).forEach(container => {
                if (container) container.innerHTML = '';
            });

            // Populate containers
            articles.forEach(article => {
                const card = createArticleCard(article);
                const targetContainer = article.hotTakeScore >= 75 ? 
                    containers.classicTakes : 
                    containers.hotTakes;
                
                if (targetContainer) targetContainer.insertAdjacentHTML('beforeend', card);
                
                // Populate search/all takes if available
                if (containers.searchResults) containers.searchResults.innerHTML += card;
                if (containers.allTakes) containers.allTakes.innerHTML += card;
            });

            // Update empty states
            const updateEmptyState = (containerId, emptyStateId) => {
                const container = document.getElementById(containerId);
                const emptyState = document.getElementById(emptyStateId);
                if (container && emptyState) {
                    emptyState.style.display = container.children.length ? 'none' : 'block';
                }
            };

            updateEmptyState('hotTakes', 'hotTakesEmpty');
            updateEmptyState('classicTakes', 'classicTakesEmpty');
            updateEmptyState('searchResults', 'noResults');
            updateEmptyState('allTakes', 'allEmpty');

            // Add voting handlers
            document.querySelectorAll('.hot-take-meter').forEach(meter => {
                meter.addEventListener('click', () => {
                    handleVote(Number(meter.dataset.articleId));
                });
            });

            // Load Twitter widgets
            if (typeof twttr !== 'undefined') twttr.widgets.load();

        } catch (error) {
            console.error('Failed to load articles:', error);
            showToast('Failed to load content. Refresh to try again!');
        }
    }

    // Enhanced Search Functionality
    async function performSearch() {
        try {
            const searchTerm = document.getElementById('globalSearch')?.value.toLowerCase() || '';
            const timeFilter = document.getElementById('timeFilter')?.value || 'all';
            const scoreFilter = document.getElementById('scoreFilter')?.value || 0;

            let query = supabase
                .from('articles')
                .select('*');

            if (searchTerm) {
                query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
            }

            if (timeFilter !== 'all') {
                const date = new Date();
                if (timeFilter === 'week') date.setDate(date.getDate() - 7);
                if (timeFilter === 'month') date.setMonth(date.getMonth() - 1);
                query = query.gte('created_at', date.toISOString());
            }

            if (scoreFilter > 0) {
                query = query.gte('hotTakeScore', scoreFilter);
            }

            const { data: articles, error } = await query;
            if (error) throw error;

            const container = document.getElementById('searchResults');
            if (container) {
                container.innerHTML = articles.map(createArticleCard).join('');
                document.getElementById('noResults').style.display = 
                    articles.length ? 'none' : 'block';
            }

        } catch (error) {
            console.error('Search failed:', error);
            showToast('Search failed. Try again!');
        }
    }

    // Form Handling with Loading State
    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="mini-spinner"></div>';

            const newArticle = {
                title: DOMPurify.sanitize(form.takeTitle.value),
                author: DOMPurify.sanitize(form.takeName.value),
                content: DOMPurify.sanitize(form.takeContent.value),
                xPostLink: DOMPurify.sanitize(form.xPostLink.value),
                image: localStorage.getItem('tempImage') || '',
                hotTakeScore: 0
            };

            const { error } = await supabase
                .from('articles')
                .insert([newArticle]);

            if (error) throw error;

            showToast('Take launched! 🚀');
            form.reset();
            localStorage.removeItem('tempImage');
            document.querySelector('.image-preview-container').innerHTML = '';
            loadArticles();

        } catch (error) {
            console.error('Submission failed:', error);
            showToast('Failed to launch take. Try again!');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Launch Take 🚀';
        }
    }

    // Image Upload Handler
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!config.allowedImageTypes.includes(file.type)) {
            alert('Only JPG/PNG images allowed!');
            e.target.value = '';
            return;
        }

        if (file.size > config.maxImageSize) {
            alert('Image too large! Max 2MB');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            localStorage.setItem('tempImage', event.target.result);
            document.querySelector('.image-preview-container').innerHTML = `
                <img src="${event.target.result}" class="image-preview">
                <button class="remove-image" onclick="this.parentElement.innerHTML = ''">×</button>
            `;
        };
        reader.readAsDataURL(file);
    }

    // Helper Functions
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('toast-hidden');
        setTimeout(() => toast.classList.add('toast-hidden'), 3000);
    }

    function updateCharCount() {
        const counter = document.getElementById('charCount');
        if (counter) {
            const textarea = document.getElementById('takeContent');
            counter.textContent = `${textarea.value.length}/500`;
        }
    }

    // Real-Time Updates
    const realtimeChannel = supabase
        .channel('realtime-articles')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'articles'
        }, () => loadArticles())
        .subscribe();

    // Event Listeners Setup
    function setupEventListeners() {
        darkModeToggle?.addEventListener('click', toggleDarkMode);
        document.getElementById('searchInput')?.addEventListener('input', performSearch);
        document.getElementById('globalSearch')?.addEventListener('input', performSearch);
        document.getElementById('takeImage')?.addEventListener('change', handleImageUpload);
        document.getElementById('takeContent')?.addEventListener('input', updateCharCount);
        
        const forms = document.querySelectorAll('.take-form');
        forms.forEach(form => {
            form.addEventListener('submit', handleFormSubmit);
        });
    }

    // Initialization
    function initializeApp() {
        initializeDarkMode();
        setupEventListeners();
        loadArticles();
    }

    initializeApp();
});
