// scripts/app.js
document.addEventListener('DOMContentLoaded', function() {
    const config = {
        maxImageSize: 2 * 1024 * 1024,
        allowedImageTypes: ['image/jpeg', 'image/png']
    };

    // Supabase Client
    const SUPABASE_URL = 'https://zlgdklqjaomnlfteairf.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2RrbHFqYW9tbmxmdGVhaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjMxODQsImV4cCI6MjA1OTYzOTE4NH0.UlpTet57p8RZcmJ5ULf2TCFVG_rTubx7rLHRTHRFRn8';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State Management
    let currentUser = null;
    let votedArticles = JSON.parse(localStorage.getItem('voted')) || [];

    // Dark Mode Functions (keep existing)

    // Article Card Creation (keep existing)

    // Enhanced Voting System
    async function handleVote(articleId) {
        if (votedArticles.includes(articleId)) return;
        
        const { data: article, error } = await supabase
            .from('articles')
            .select('hotTakeScore')
            .eq('id', articleId)
            .single();

        if (!error) {
            const newScore = Math.min(article.hotTakeScore + 20, 100);
            const { error: updateError } = await supabase
                .from('articles')
                .update({ hotTakeScore: newScore })
                .eq('id', articleId);

            if (!updateError) {
                votedArticles.push(articleId);
                localStorage.setItem('voted', JSON.stringify(votedArticles));
                loadArticles();
            }
        }
    }

    // Real-Time Updates
    const articlesChannel = supabase
        .channel('realtime-articles')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'articles'
        }, () => loadArticles())
        .subscribe();

    // Enhanced Form Submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="mini-spinner"></div>';

        try {
            const newArticle = {
                title: DOMPurify.sanitize(document.getElementById('takeTitle').value),
                author: DOMPurify.sanitize(document.getElementById('takeName').value),
                content: DOMPurify.sanitize(document.getElementById('takeContent').value),
                xPostLink: DOMPurify.sanitize(document.getElementById('xPostLink').value),
                image: localStorage.getItem('tempImage') || '',
                hotTakeScore: 0,
                verified: false
            };

            const { error } = await supabase
                .from('articles')
                .insert([newArticle]);

            if (error) throw error;
            
            showToast('Take launched! 🚀');
            e.target.reset();
            localStorage.removeItem('tempImage');
            document.querySelector('.image-preview-container').innerHTML = '';

        } catch (error) {
            showToast('Failed to launch take. Try again!');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Launch Take 🚀';
        }
    }

    // Initialize App
    function initializeApp() {
        // Existing initializations
        loadArticles();
        setupEventListeners();
        checkAuthState();
    }

    initializeApp();
});
