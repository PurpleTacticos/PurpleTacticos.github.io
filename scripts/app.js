// scripts/app.js
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const config = {
        maxImageSize: 2 * 1024 * 1024,
        allowedImageTypes: ['image/jpeg', 'image/png']
    };

    // Supabase Client
    const SUPABASE_URL = 'https://zlgdklqjaomnlfteairf.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2RrbHFqYW9tbmxmdGVhaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjMxODQsImV4cCI6MjA1OTYzOTE4NH0.UlpTet57p8RZcmJ5ULf2TCFVG_rTubx7rLHRTHRFRn8';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State Management
    let votedArticles = JSON.parse(localStorage.getItem('voted')) || [];
    
    // Dark Mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    const icon = darkModeToggle?.querySelector('i');

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

    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error:', err));
    }

    // Article Card Creation
    function createArticleCard(article) {
        const safeContent = DOMPurify.sanitize(article.content.substring(0, 100));
        const isVoted = votedArticles.includes(article.id);
        const hotScore = article.hot_score || 0;
        const trashScore = article.trash_score || 0;
        const totalVotes = hotScore + trashScore;
        const hotPercentage = totalVotes > 0 ? (hotScore / totalVotes) * 100 : 50;
        const trashPercentage = totalVotes > 0 ? (trashScore / totalVotes) * 100 : 50;

        return `
            <div class="article-card" data-id="${article.id}">
                ${article.image ? `<img src="${article.image}" class="article-image" alt="Take image">` : ''}
                ${article.xPostLink ? `<blockquote class="twitter-tweet"><a href="${DOMPurify.sanitize(article.xPostLink)}"></a></blockquote>` : ''}
                <div class="article-content">
                    <h3 class="article-title">${DOMPurify.sanitize(article.title)}</h3>
                    <p class="article-excerpt">${safeContent}${article.content.length > 100 ? '...' : ''}</p>
                    <div class="article-meta">
                        <span>${DOMPurify.sanitize(article.author)}</span>
                        <span>${new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="vote-container">
                        <div class="meter hot-meter ${isVoted ? 'voted' : ''}" 
                             onclick="handleVote('${article.id}', 'hot')">
                            <div class="score-bar" style="width: ${hotPercentage}%"></div>
                            <span class="score">🔥 ${hotScore}</span>
                        </div>
                        <div class="meter trash-meter ${isVoted ? 'voted' : ''}" 
                             onclick="handleVote('${article.id}', 'trash')">
                            <div class="score-bar" style="width: ${trashPercentage}%"></div>
                            <span class="score">🗑️ ${trashScore}</span>
                        </div>
                    </div>
                    <div class="comments-section">
                        <div class="comment-form">
                            <input type="text" id="commentInput-${article.id}" 
                                   placeholder="Add your take..." maxlength="280">
                            <button onclick="handleCommentSubmit('${article.id}')">Post</button>
                        </div>
                        <div id="comments-${article.id}" class="comments-container"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Voting System
    window.handleVote = async (articleId, voteType) => {
        if (votedArticles.includes(articleId)) {
            showToast('You already voted!');
            return;
        }

        try {
            const { data: article, error } = await supabase
                .from('articles')
                .select('hot_score, trash_score')
                .eq('id', articleId)
                .single();

            if (error) throw error;

            const updates = voteType === 'hot' 
                ? { hot_score: (article.hot_score || 0) + 1 } 
                : { trash_score: (article.trash_score || 0) + 1 };

            const { error: updateError } = await supabase
                .from('articles')
                .update(updates)
                .eq('id', articleId);

            if (!updateError) {
                votedArticles.push(articleId);
                localStorage.setItem('voted', JSON.stringify(votedArticles));
                loadArticles();
            }
        } catch (error) {
            showToast('Voting failed. Try again!');
        }
    };

    // Comment System
    window.handleCommentSubmit = async (articleId) => {
        const commentInput = document.getElementById(`commentInput-${articleId}`);
        const comment = DOMPurify.sanitize(commentInput.value.trim());
        
        if (!comment) {
            showToast('Comment cannot be empty!');
            return;
        }

        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    article_id: articleId,
                    content: comment,
                    author: 'Anonymous',
                    created_at: new Date()
                }]);

            if (error) throw error;

            commentInput.value = '';
            showToast('Comment posted!');
            loadComments(articleId);
        } catch (error) {
            showToast('Failed to post comment');
        }
    };

    window.loadComments = async (articleId) => {
        try {
            const { data: comments, error } = await supabase
                .from('comments')
                .select('*')
                .eq('article_id', articleId)
                .order('created_at', { ascending: false });

            const container = document.getElementById(`comments-${articleId}`);
            if (container) {
                container.innerHTML = comments.map(comment => `
                    <div class="comment">
                        <div class="comment-header">
                            <span class="comment-author">${comment.author}</span>
                            <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p class="comment-content">${comment.content}</p>
                    </div>
                `).join('') || '<p class="empty-comments">No comments yet!</p>';
            }
        } catch (error) {
            console.error('Comments error:', error);
        }
    };

    // Article Loading
    async function loadArticles() {
        try {
            showLoading(true);
            const { data: articles, error } = await supabase
                .from('articles')
                .select('*')
                .order('created_at', { ascending: false });

            const containers = {
                hotTakes: document.getElementById('hotTakes'),
                classicTakes: document.getElementById('classicTakes'),
                searchResults: document.getElementById('searchResults'),
                allTakes: document.getElementById('allTakes')
            };

            Object.values(containers).forEach(c => c && (c.innerHTML = ''));

            articles.forEach(article => {
                const card = createArticleCard(article);
                let targetContainer = containers.allTakes || containers.searchResults || 
                    ((article.hot_score || 0) >= 75 ? containers.classicTakes : containers.hotTakes);
                
                if (targetContainer) {
                    targetContainer.insertAdjacentHTML('beforeend', card);
                    setTimeout(() => loadComments(article.id), 100);
                }
            });

            ['hotTakes', 'classicTakes', 'searchResults', 'allTakes'].forEach(id => {
                const container = document.getElementById(id);
                const emptyState = document.getElementById(`${id}Empty`);
                if (container && emptyState) {
                    emptyState.style.display = container.children.length ? 'none' : 'block';
                }
            });

        } catch (error) {
            showToast('Failed to load content');
        } finally {
            showLoading(false);
            if (typeof twttr !== 'undefined') twttr.widgets.load();
        }
    }

    // Filter System
    async function handleFilterClick(e) {
        const category = e.target.dataset.category;
        try {
            let query = supabase.from('articles').select('*');
            
            switch(category) {
                case 'hot':
                    query = query.gte('hot_score', 50);
                    break;
                case 'controversial':
                    query = query.gte('trash_score', 30);
                    break;
                case 'tactical':
                    query = query.ilike('title', '%tactics%');
                    break;
            }

            const { data: articles, error } = await query;
            document.getElementById('hotTakes').innerHTML = articles.map(createArticleCard).join('');
        } catch (error) {
            showToast('Filter error');
        }
    }

    // Sorting System
    async function handleSortChange(e) {
        try {
            let query = supabase.from('articles').select('*');
            
            switch(e.target.value) {
                case 'hottest':
                    query = query.order('hot_score', { ascending: false });
                    break;
                case 'controversial':
                    query = query.order('trash_score', { ascending: false });
                    break;
                default:
                    query = query.order('created_at', { ascending: false });
            }

            const { data: articles, error } = await query;
            document.getElementById('allTakes').innerHTML = articles.map(createArticleCard).join('');
        } catch (error) {
            showToast('Sorting failed');
        }
    }

    // Form Handling
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
                image: localStorage.getItem('tempImage') || null,
                hot_score: 0,
                trash_score: 0
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
            console.error('Submission error:', error);
            showToast('Failed to submit take');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Launch Take 🚀';
        }
    }

    // Image Upload
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!config.allowedImageTypes.includes(file.type)) {
            showToast('Only JPG/PNG allowed!');
            e.target.value = '';
            return;
        }

        if (file.size > config.maxImageSize) {
            showToast('Max 2MB allowed!');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            localStorage.setItem('tempImage', event.target.result);
            document.querySelector('.image-preview-container').innerHTML = `
                <img src="${event.target.result}" class="image-preview">
                <button class="remove-image" 
                        onclick="this.parentElement.innerHTML = ''; localStorage.removeItem('tempImage')">
                    ×
                </button>
            `;
            if (window.twttr) window.twttr.widgets.load();
        };
        reader.readAsDataURL(file);
    }

    // Search System
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
                query = query.gte('hot_score', scoreFilter);
            }

            const { data: articles, error } = await query;
            const container = document.getElementById('searchResults');
            if (container) {
                container.innerHTML = articles.map(createArticleCard).join('');
                document.getElementById('noResults').style.display = 
                    articles.length ? 'none' : 'block';
                
                articles.forEach(article => loadComments(article.id));
            }

        } catch (error) {
            showToast('Search failed');
        }
    }

    // Helper Functions
    function showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
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

    function showLoading(show) {
        const spinner = document.getElementById('loading');
        if (spinner) spinner.style.display = show ? 'block' : 'none';
    }

    // Event Listeners
    function setupEventListeners() {
        darkModeToggle?.addEventListener('click', toggleDarkMode);
        document.getElementById('searchInput')?.addEventListener('input', performSearch);
        document.getElementById('globalSearch')?.addEventListener('input', performSearch);
        document.getElementById('takeImage')?.addEventListener('change', handleImageUpload);
        document.getElementById('takeContent')?.addEventListener('input', updateCharCount);
        document.getElementById('sortFilter')?.addEventListener('change', handleSortChange);
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', handleFilterClick);
        });

        document.querySelectorAll('.take-form').forEach(form => {
            form.addEventListener('submit', handleFormSubmit);
        });
    }

    // Initialize
    function initializeApp() {
        try {
            initializeDarkMode();
            setupEventListeners();
            loadArticles();
        } catch (error) {
            console.error('Critical error:', error);
            document.body.innerHTML = `<h1>System Error</h1><p>${error.message}</p>`;
        }
    }

    initializeApp();
});
