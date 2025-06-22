document.addEventListener('DOMContentLoaded', () => {
    const gameBoardElement = document.getElementById('game-board');
    const currentScoreElement = document.getElementById('current-score');
    const targetScoreElement = document.getElementById('target-score');
    const currentLevelElement = document.getElementById('current-level');
    const infoModal = document.getElementById('info-modal');
    const infoTextElement = document.getElementById('info-text');
    const quizModal = document.getElementById('quiz-modal');
    const quizQuestionTitleElement = document.getElementById('quiz-question-title');
    const quizQuestionElement = document.getElementById('quiz-question');
    const quizOptionsElement = document.getElementById('quiz-options');
    const quizFeedbackElement = document.getElementById('quiz-feedback');
    const nextQuestionButton = document.getElementById('next-question-button');
    const startQuizButton = document.getElementById('start-quiz-button');
    const gameCompleteModal = document.getElementById('game-complete-modal');
    const resetLevelButton = document.getElementById('reset-level-button');
    const backgroundMusic = document.getElementById('background-music');
    const matchSound = document.getElementById('match-sound');

    const animalIcons = ['🍎', '🍌', '🍓', '🍊', '🍋', '🍉', '🍇', '🍑', '🍒', '🥝']; // 苹果、香蕉、草莓、橘子、柠檬、西瓜、葡萄、桃子、樱桃、猕猴桃

    let currentLevel = 0;
    let score = 0;
    let board = [];
    let selectedCell = null;
    let rows, cols, targetScore, itemTypes;
    let currentQuiz = [];
    let currentQuestionIndex = 0;
    let isCheckingMatch = false; // Flag to prevent concurrent match checks
    let musicStarted = false;
    let inactivityTimer = null; // 用户无操作计时器
    let hintTimeout = 10000; // 无操作10秒后显示提示
    let currentHintCell = null; // 当前提示的单元格
    let shuffleAvailable = false; // 是否有可用的洗牌道具
    let previousLevelQuestions = []; // 存储上一关的问题，用于下一关的洗牌道具获取

    function playBackgroundMusic() {
        if (backgroundMusic && backgroundMusic.paused && !musicStarted) {
            backgroundMusic.volume = 0.5; // 设置音量为50%
            backgroundMusic.play().catch(e => {
                console.error("背景音乐播放失败: ", e);
                // 添加一个音乐播放按钮，让用户手动触发
                if (!document.getElementById('music-button')) {
                    const musicButton = document.createElement('button');
                    musicButton.id = 'music-button';
                    musicButton.className = 'music-button';
                    musicButton.innerHTML = '🎵';
                    musicButton.title = '播放背景音乐';
                    musicButton.addEventListener('click', () => {
                        backgroundMusic.play().catch(e => console.error("手动播放背景音乐失败: ", e));
                        musicButton.style.display = 'none';
                    });
                    document.body.appendChild(musicButton);
                }
            });
            musicStarted = true;
        }
    }

    // Try to play music on first user interaction
    document.body.addEventListener('click', playBackgroundMusic, { once: true });
    document.body.addEventListener('touchstart', playBackgroundMusic, { once: true });


    function playMatchSound() {
        if (matchSound) {
            matchSound.currentTime = 0; // 重置到开始
            matchSound.volume = 0.6; // 设置音量为60%
            matchSound.play().catch(e => console.error("音效播放失败: ", e));
        }
    }

    // 重置用户无操作计时器
    function resetInactivityTimer() {
        // 清除现有的计时器
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            // 移除当前的提示效果
            if (currentHintCell) {
                const hintCells = document.querySelectorAll('.game-cell.hint');
                hintCells.forEach(cell => cell.classList.remove('hint'));
                currentHintCell = null;
            }
        }
        
        // 设置新的计时器
        inactivityTimer = setTimeout(() => {
            showHint();
        }, hintTimeout);
    }
    
    // 显示可能的匹配提示
    function showHint() {
        // 如果正在检查匹配或者游戏已经结束，不显示提示
        if (isCheckingMatch || score >= targetScore) return;
        
        // 查找可能的匹配
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // 尝试与右侧交换
                if (c + 1 < cols) {
                    swapCells(r, c, r, c + 1);
                    const matches = checkMatchAt(r, c).concat(checkMatchAt(r, c + 1));
                    swapCells(r, c, r, c + 1); // 交换回来
                    
                    if (matches.length > 0) {
                        // 找到可能的匹配，显示两个可交换的图案提示
                        const cell1 = document.querySelector(`.game-cell[data-r="${r}"][data-c="${c}"]`);
                        const cell2 = document.querySelector(`.game-cell[data-r="${r}"][data-c="${c+1}"]`);
                        if (cell1 && cell2) {
                            cell1.classList.add('hint');
                            cell2.classList.add('hint');
                            currentHintCell = { r1: r, c1: c, r2: r, c2: c+1 };
                            return;
                        }
                    }
                }
                
                // 尝试与下方交换
                if (r + 1 < rows) {
                    swapCells(r, c, r + 1, c);
                    const matches = checkMatchAt(r, c).concat(checkMatchAt(r + 1, c));
                    swapCells(r, c, r + 1, c); // 交换回来
                    
                    if (matches.length > 0) {
                        // 找到可能的匹配，显示两个可交换的图案提示
                        const cell1 = document.querySelector(`.game-cell[data-r="${r}"][data-c="${c}"]`);
                        const cell2 = document.querySelector(`.game-cell[data-r="${r+1}"][data-c="${c}"]`);
                        if (cell1 && cell2) {
                            cell1.classList.add('hint');
                            cell2.classList.add('hint');
                            currentHintCell = { r1: r, c1: c, r2: r+1, c2: c };
                            return;
                        }
                    }
                }
            }
        }
    }
    
    function startGame() {
        currentLevel = 0;
        score = 0;
        shuffleAvailable = false;
        previousLevelQuestions = [];
        usedShuffleQuestionIndices = {}; // 重置已使用的洗牌问题记录
        loadLevel();
        gameCompleteModal.style.display = 'none';
        playBackgroundMusic();
        resetInactivityTimer(); // 初始化无操作计时器
    }

    // 洗牌功能 - 重新排列游戏板上的所有图案
    function shuffleBoard() {
        if (!shuffleAvailable) {
            // 如果没有洗牌道具，则显示洗牌答题模态框
            if (currentLevel > 0 && previousLevelQuestions.length > 0) {
                showShuffleQuiz();
            } else {
                alert("需要先通过答题获取洗牌道具！");
            }
            return;
        }
        
        // 收集所有非空单元格的值
        const allItems = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] !== -1) {
                    allItems.push(board[r][c]);
                }
            }
        }
        
        // 打乱顺序
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
        
        // 重新分配到游戏板
        let index = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] !== -1) {
                    board[r][c] = allItems[index++];
                }
            }
        }
        
        // 确保没有初始匹配
        let initialMatches = true;
        while(initialMatches) {
            initialMatches = false;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (checkMatchAt(r, c).length > 0) {
                        board[r][c] = getRandomItem();
                        initialMatches = true;
                    }
                }
            }
        }
        
        // 使用洗牌道具后设置为不可用
        shuffleAvailable = false;
        updateShuffleButton();
        renderBoard();
        resetInactivityTimer();
    }
    
    // 用于跟踪每个关卡已使用的洗牌问题索引
    let usedShuffleQuestionIndices = {};
    
    // 显示洗牌答题模态框
    function showShuffleQuiz() {
        // 从上一关的问题中随机选择一个
        if (currentLevel <= 0 || previousLevelQuestions.length === 0) {
            return;
        }
        
        // 获取上一关的问题数据
        const prevLevelData = gameLevels[currentLevel - 1];
        const prevQuestions = prevLevelData.quiz;
        
        // 初始化当前关卡的已使用问题索引数组（如果不存在）
        if (!usedShuffleQuestionIndices[currentLevel]) {
            usedShuffleQuestionIndices[currentLevel] = [];
        }
        
        // 如果所有问题都已使用过，则重置已使用问题记录
        if (usedShuffleQuestionIndices[currentLevel].length >= prevQuestions.length) {
            usedShuffleQuestionIndices[currentLevel] = [];
        }
        
        // 获取未使用的问题索引
        let availableIndices = [];
        for (let i = 0; i < prevQuestions.length; i++) {
            if (!usedShuffleQuestionIndices[currentLevel].includes(i)) {
                availableIndices.push(i);
            }
        }
        
        // 随机选择一个未使用的问题
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        usedShuffleQuestionIndices[currentLevel].push(randomIndex); // 记录已使用的问题索引
        
        const selectedQuestion = prevQuestions[randomIndex];
        
        // 设置问题和选项
        const shuffleQuizQuestionElement = document.getElementById('shuffle-quiz-question');
        const shuffleQuizOptionsElement = document.getElementById('shuffle-quiz-options');
        const shuffleQuizFeedbackElement = document.getElementById('shuffle-quiz-feedback');
        const shuffleQuizCloseButton = document.getElementById('shuffle-quiz-close-button');
        
        shuffleQuizQuestionElement.textContent = selectedQuestion.question;
        shuffleQuizOptionsElement.innerHTML = '';
        shuffleQuizFeedbackElement.textContent = '';
        shuffleQuizCloseButton.style.display = 'none';
        
        selectedQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.addEventListener('click', () => handleShuffleQuizAnswer(option, selectedQuestion.answer));
            shuffleQuizOptionsElement.appendChild(button);
        });
        
        // 显示模态框
        document.getElementById('shuffle-quiz-modal').style.display = 'flex';
        resetInactivityTimer();
    }
    
    // 处理洗牌答题的回答
    function handleShuffleQuizAnswer(selectedOption, correctAnswer) {
        const shuffleQuizOptionsElement = document.getElementById('shuffle-quiz-options');
        const shuffleQuizFeedbackElement = document.getElementById('shuffle-quiz-feedback');
        const shuffleQuizCloseButton = document.getElementById('shuffle-quiz-close-button');
        
        // 禁用所有选项按钮
        const buttons = shuffleQuizOptionsElement.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = true;
            if (button.textContent === correctAnswer) {
                button.classList.add('correct');
            }
            if (button.textContent === selectedOption && selectedOption !== correctAnswer) {
                button.classList.add('incorrect');
            }
        });
        
        // 处理回答结果
        if (selectedOption === correctAnswer) {
            shuffleQuizFeedbackElement.textContent = '回答正确！获得了洗牌道具！';
            shuffleQuizFeedbackElement.style.color = 'green';
            shuffleAvailable = true;
            updateShuffleButton();
        } else {
            shuffleQuizFeedbackElement.textContent = `回答错误。正确答案是：${correctAnswer}`;
            shuffleQuizFeedbackElement.style.color = 'red';
        }
        
        // 显示关闭按钮
        shuffleQuizCloseButton.style.display = 'block';
        shuffleQuizCloseButton.addEventListener('click', closeShuffleQuizModal);
        
        resetInactivityTimer();
    }
    
    // 关闭洗牌答题模态框
    window.closeShuffleQuizModal = function() {
        document.getElementById('shuffle-quiz-modal').style.display = 'none';
        resetInactivityTimer();
    }
    
    // 显示洗牌答题模态框
    function showShuffleQuiz() {
        // 从上一关的问题中随机选择一个
        if (currentLevel <= 0 || previousLevelQuestions.length === 0) {
            return;
        }
        
        // 获取上一关的问题数据
        const prevLevelData = gameLevels[currentLevel - 1];
        const prevQuestions = prevLevelData.quiz;
        
        // 随机选择一个问题
        const randomIndex = Math.floor(Math.random() * prevQuestions.length);
        const selectedQuestion = prevQuestions[randomIndex];
        
        // 设置问题和选项
        const shuffleQuizQuestionElement = document.getElementById('shuffle-quiz-question');
        const shuffleQuizOptionsElement = document.getElementById('shuffle-quiz-options');
        const shuffleQuizFeedbackElement = document.getElementById('shuffle-quiz-feedback');
        const shuffleQuizCloseButton = document.getElementById('shuffle-quiz-close-button');
        
        shuffleQuizQuestionElement.textContent = selectedQuestion.question;
        shuffleQuizOptionsElement.innerHTML = '';
        shuffleQuizFeedbackElement.textContent = '';
        shuffleQuizCloseButton.style.display = 'none';
        
        selectedQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.addEventListener('click', () => handleShuffleQuizAnswer(option, selectedQuestion.answer));
            shuffleQuizOptionsElement.appendChild(button);
        });
        
        // 显示模态框
        document.getElementById('shuffle-quiz-modal').style.display = 'flex';
        resetInactivityTimer();
    }
    
    // 处理洗牌答题的回答
    function handleShuffleQuizAnswer(selectedOption, correctAnswer) {
        const shuffleQuizOptionsElement = document.getElementById('shuffle-quiz-options');
        const shuffleQuizFeedbackElement = document.getElementById('shuffle-quiz-feedback');
        const shuffleQuizCloseButton = document.getElementById('shuffle-quiz-close-button');
        
        // 禁用所有选项按钮
        const buttons = shuffleQuizOptionsElement.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = true;
            if (button.textContent === correctAnswer) {
                button.classList.add('correct');
            }
            if (button.textContent === selectedOption && selectedOption !== correctAnswer) {
                button.classList.add('incorrect');
            }
        });
        
        // 处理回答结果
        if (selectedOption === correctAnswer) {
            shuffleQuizFeedbackElement.textContent = '回答正确！获得了洗牌道具！';
            shuffleQuizFeedbackElement.style.color = 'green';
            shuffleAvailable = true;
            updateShuffleButton();
        } else {
            shuffleQuizFeedbackElement.textContent = `回答错误。正确答案是：${correctAnswer}`;
            shuffleQuizFeedbackElement.style.color = 'red';
        }
        
        // 显示关闭按钮
        shuffleQuizCloseButton.style.display = 'block';
        shuffleQuizCloseButton.addEventListener('click', closeShuffleQuizModal);
        
        resetInactivityTimer();
    }
    
    // 关闭洗牌答题模态框
    window.closeShuffleQuizModal = function() {
        document.getElementById('shuffle-quiz-modal').style.display = 'none';
        resetInactivityTimer();
    }
    
    // 更新洗牌按钮状态
    function updateShuffleButton() {
        const shuffleButton = document.getElementById('shuffle-button');
        if (!shuffleButton) return;
        
        if (shuffleAvailable) {
            shuffleButton.disabled = false;
            shuffleButton.classList.remove('disabled');
            shuffleButton.title = '点击重新洗牌';
            shuffleButton.textContent = '🔄 使用洗牌道具';
        } else {
            shuffleButton.disabled = false; // 允许点击以触发答题
            shuffleButton.classList.add('disabled');
            shuffleButton.title = '点击回答问题获取洗牌道具';
            shuffleButton.textContent = '🔄 获取洗牌道具';
        }
    }
    
    function loadLevel() {
        if (currentLevel >= gameLevels.length) {
            showGameComplete();
            return;
        }

        const levelData = gameLevels[currentLevel];
        rows = levelData.rows;
        cols = levelData.cols;
        targetScore = levelData.targetScore;
        itemTypes = levelData.itemTypes;

        currentLevelElement.textContent = levelData.level;
        targetScoreElement.textContent = targetScore;
        currentScoreElement.textContent = score; // Score might carry over or reset based on design
        if(currentLevel === 0) score = 0; // Reset score only at the very beginning
        currentScoreElement.textContent = score;


        board = [];
        selectedCell = null;
        isCheckingMatch = false;
        resetLevelButton.style.display = 'block';
        
        // 如果不是第一关，存储上一关的问题
        if (currentLevel > 0) {
            previousLevelQuestions = gameLevels[currentLevel - 1].quiz;
        }
        
        // 重置当前关卡的已使用洗牌问题记录
        if (usedShuffleQuestionIndices[currentLevel]) {
            usedShuffleQuestionIndices[currentLevel] = [];
        }
        
        // 创建洗牌按钮（如果不存在）
        if (!document.getElementById('shuffle-button')) {
            const shuffleButton = document.createElement('button');
            shuffleButton.id = 'shuffle-button';
            shuffleButton.className = 'shuffle-button disabled';
            shuffleButton.innerHTML = '🔄 获取洗牌道具';
            shuffleButton.title = '点击回答问题获取洗牌道具';
            shuffleButton.addEventListener('click', shuffleBoard);
            document.querySelector('.score-level-info').appendChild(shuffleButton);
        }
        
        // 更新洗牌按钮状态
        updateShuffleButton();

        initializeBoard();
        renderBoard();
        adjustBoardSize(); // Adjust board size on load
        checkAllMatches(); // Check for initial matches and resolve them
        resetInactivityTimer(); // 重置无操作计时器
    }

    function adjustBoardSize() {
        const containerWidth = gameBoardElement.parentElement.clientWidth; // 获取游戏区域宽度
        const boardPadding = parseFloat(getComputedStyle(gameBoardElement).paddingLeft) + parseFloat(getComputedStyle(gameBoardElement).paddingRight);
        const boardGap = parseFloat(getComputedStyle(gameBoardElement).gap) || 5;

        // 对于移动设备，进一步调整大小
        const isMobile = window.innerWidth <= 768;
        const mobileScaleFactor = isMobile ? 0.9 : 1; // 在移动设备上稍微缩小

        // 根据容器宽度和高度确定最大可能的单元格大小，以保持可见性
        const maxCellSizeBasedOnWidth = ((containerWidth * mobileScaleFactor) - boardPadding - (cols - 1) * boardGap) / cols;
        
        // 考虑游戏板的合理最大高度，例如视口高度的60%
        const maxBoardHeight = window.innerHeight * (isMobile ? 0.5 : 0.6); // 移动设备上使用更小的高度比例
        const maxCellSizeBasedOnHeight = (maxBoardHeight - boardPadding - (rows - 1) * boardGap) / rows;

        // 使用两者中较小的值确保游戏板适合屏幕
        let cellSize = Math.min(maxCellSizeBasedOnWidth, maxCellSizeBasedOnHeight);
        cellSize = Math.max(20, cellSize); // 确保最小单元格大小（例如20px）

        gameBoardElement.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
        gameBoardElement.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
        
        // Set the game board's width and height explicitly to prevent overflow issues
        gameBoardElement.style.width = `${cols * cellSize + (cols - 1) * boardGap + boardPadding}px`;
        gameBoardElement.style.height = `${rows * cellSize + (rows - 1) * boardGap + boardPadding}px`;

        const cells = gameBoardElement.querySelectorAll('.game-cell');
        cells.forEach(cell => {
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.fontSize = `${Math.max(10, cellSize * 0.5)}px`; // Adjusted font size scaling for emojis
        });
    }
    
    window.addEventListener('resize', adjustBoardSize);

    function initializeBoard() {
        // gameBoardElement.style.gridTemplateColumns and rows will be set by adjustBoardSize
        board = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push(getRandomItem());
            }
            board.push(row);
        }
        // Ensure no initial matches
        let initialMatches = true;
        while(initialMatches) {
            initialMatches = false;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (checkMatchAt(r, c).length > 0) {
                        board[r][c] = getRandomItem();
                        initialMatches = true;
                    }
                }
            }
        }
    }

    function getRandomItem() {
        return Math.floor(Math.random() * itemTypes);
    }

    function renderBoard() {
        gameBoardElement.innerHTML = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('game-cell');
                cell.dataset.r = r;
                cell.dataset.c = c;

                if (board[r][c] === -1) { // -1 indicates an empty cell (to be filled)
                    cell.classList.add('hidden');
                    cell.textContent = ''; // Clear content for hidden cells
                } else {
                    // Use animal icon based on item type
                    // Ensure itemTypes in data.js doesn't exceed animalIcons.length
                    cell.textContent = animalIcons[board[r][c] % animalIcons.length]; 
                }
                
                cell.addEventListener('click', handleCellClick);
                gameBoardElement.appendChild(cell);
            }
        }
        // After rendering, ensure font size is appropriate for the new content
        adjustBoardSize(); // Call adjustBoardSize again to potentially re-evaluate font sizes based on content
    }

    function handleCellClick(event) {
        if (isCheckingMatch) return; // Don't allow clicks during match processing
        
        // 重置无操作计时器
        resetInactivityTimer();
        
        const r = parseInt(event.target.dataset.r);
        const c = parseInt(event.target.dataset.c);

        if (board[r][c] === -1) return; // Ignore clicks on hidden/empty cells

        if (!selectedCell) {
            selectedCell = { r, c, element: event.target };
            event.target.classList.add('selected');
        } else {
            const prevR = selectedCell.r;
            const prevC = selectedCell.c;
            selectedCell.element.classList.remove('selected');

            if (Math.abs(prevR - r) + Math.abs(prevC - c) === 1) { // Check for adjacency
                swapCells(prevR, prevC, r, c);
                renderBoard(); // Re-render immediately to show swap

                // Check for matches after a short delay to allow visual swap
                isCheckingMatch = true;
                setTimeout(() => {
                    const match1 = checkMatchAt(prevR, prevC);
                    const match2 = checkMatchAt(r, c);

                    if (match1.length > 0 || match2.length > 0) {
                        if (match1.length > 0) processMatches(match1);
                        if (match2.length > 0) processMatches(match2);
                        // Further checks will be chained in processMatches/refillBoard
                    } else {
                        // No match, swap back
                        swapCells(prevR, prevC, r, c);
                        renderBoard();
                        isCheckingMatch = false;
                    }
                    selectedCell = null;
                }, 200);
            } else {
                selectedCell = { r, c, element: event.target };
                event.target.classList.add('selected');
            }
        }
    }

    function swapCells(r1, c1, r2, c2) {
        const temp = board[r1][c1];
        board[r1][c1] = board[r2][c2];
        board[r2][c2] = temp;
    }

    function checkMatchAt(r, c) {
        const itemType = board[r][c];
        if (itemType === -1) return [];
        const matches = [{ r, c }];

        // Check horizontal
        let left = c - 1, right = c + 1;
        while (left >= 0 && board[r][left] === itemType) { matches.push({ r, c: left }); left--; }
        while (right < cols && board[r][right] === itemType) { matches.push({ r, c: right }); right++; }
        
        let horizontalMatches = matches.filter(cell => cell.r === r);
        if (horizontalMatches.length < 3) horizontalMatches = [];

        // Check vertical
        let up = r - 1, down = r + 1;
        const verticalMatchesTemp = [{r,c}]; // Start fresh for vertical check from the original point
        while (up >= 0 && board[up][c] === itemType) { verticalMatchesTemp.push({ r: up, c }); up--; }
        while (down < rows && board[down][c] === itemType) { verticalMatchesTemp.push({ r: down, c }); down++; }
        
        let verticalMatches = verticalMatchesTemp;
        if (verticalMatches.length < 3) verticalMatches = [];

        let combinedMatches = [];
        if(horizontalMatches.length >=3) combinedMatches = combinedMatches.concat(horizontalMatches);
        if(verticalMatches.length >=3) combinedMatches = combinedMatches.concat(verticalMatches);
        
        // Remove duplicates if a cell is part of both horizontal and vertical match from the center point
        const uniqueMatches = Array.from(new Set(combinedMatches.map(JSON.stringify))).map(JSON.parse);
        
        return uniqueMatches.length >= 3 ? uniqueMatches : [];
    }

    function processMatches(matches) {
        if (matches.length === 0) {
            isCheckingMatch = false;
            return;
        }
        
        let pointsEarned = 0;
        matches.forEach(cell => {
            if (board[cell.r][cell.c] !== -1) { // Ensure not already processed
                pointsEarned += 10; // Simple scoring: 10 points per item
                board[cell.r][cell.c] = -1; // Mark as empty
            }
        });

        if (pointsEarned > 0) {
            score += pointsEarned;
            currentScoreElement.textContent = score;
            playMatchSound(); // Play sound on match
        }
        
        renderBoard(); // Show cleared cells

        setTimeout(() => {
            dropAndRefill();
        }, 300); // Delay for visual effect of clearing
    }

    function dropAndRefill() {
        let cellsMoved = false;
        // Drop existing items
        for (let c = 0; c < cols; c++) {
            let emptyRow = -1;
            for (let r = rows - 1; r >= 0; r--) {
                if (board[r][c] === -1 && emptyRow === -1) {
                    emptyRow = r;
                }
                if (board[r][c] !== -1 && emptyRow !== -1) {
                    board[emptyRow][c] = board[r][c];
                    board[r][c] = -1;
                    emptyRow--;
                    cellsMoved = true;
                }
            }
        }

        // Refill new items from top
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] === -1) {
                    board[r][c] = getRandomItem();
                    cellsMoved = true;
                }
            }
        }
        
        renderBoard(); // Show dropped and refilled cells

        if (cellsMoved) {
            setTimeout(() => {
                checkAllMatches(); // Check for new matches after refill
            }, 300);
        } else {
            isCheckingMatch = false; // No more moves, ready for next player action
            checkLevelComplete();
        }
    }

    function checkAllMatches() {
        isCheckingMatch = true;
        let anyMatchFound = false;
        const allMatches = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] !== -1) {
                    const matches = checkMatchAt(r, c);
                    if (matches.length > 0) {
                        matches.forEach(match => allMatches.push(match));
                        anyMatchFound = true;
                    }
                }
            }
        }

        const uniqueAllMatches = Array.from(new Set(allMatches.map(JSON.stringify))).map(JSON.parse);

        if (anyMatchFound) {
            processMatches(uniqueAllMatches);
        } else {
            isCheckingMatch = false;
            checkLevelComplete();
        }
    }

    function checkLevelComplete() {
        if (score >= targetScore) {
            resetLevelButton.style.display = 'none';
            showLevelComplete();
        }
    }
    
    // 显示关卡完成信息
    function showLevelComplete() {
        // 检查是否是最后一关（第6关）
        if (currentLevel === gameLevels.length - 1) {
            // 如果是最后一关，直接显示通关弹窗
            showGameComplete();
        } else {
            // 否则显示本关卡的科普信息
            showInfo();
        }
        resetInactivityTimer(); // 重置无操作计时器
    }
    
    // 显示关卡过渡弹窗
    function showLevelTransition() {
        const transitionModal = document.getElementById('level-transition-modal');
        const transitionMessage = document.getElementById('transition-message');
        const thumbsUpContainer = document.getElementById('thumbs-up-container');
        const continueButton = document.getElementById('continue-button');
        
        // 根据即将进入的关卡设置不同的消息
        let message = '';
        const nextLevel = currentLevel + 1;
        
        // 显示大拇指动画（所有关卡都显示）
        thumbsUpContainer.style.display = 'block';
        
        if (nextLevel === 2) {
            message = '你真的太棒了，恭喜进入下一关';
        } else if (nextLevel === 3) {
            message = '你又学到了一些新知识，真是太厉害了';
        } else if (nextLevel === 4) {
            message = '你真是个闯关小能手，请继续努力吧！';
        } else if (nextLevel === 5) {
            message = '哇！太棒了吧！你一定是个高手！';
        } else if (nextLevel === 6) {
            message = '你已经快成为知识小达人了，加油吧！';
            thumbsUpContainer.style.display = 'block'; // 显示大拇指
        } else {
            message = '恭喜完成本关卡！';
        }
        
        transitionMessage.textContent = message;
        
        // 设置继续按钮点击事件
        continueButton.onclick = function() {
            transitionModal.style.display = 'none';
            currentLevel++;
            loadLevel();
        };
        
        // 显示过渡弹窗
        transitionModal.style.display = 'flex';
        resetInactivityTimer();
    }

    function showInfo() {
        infoTextElement.textContent = gameLevels[currentLevel].info;
        infoModal.style.display = 'flex';
        resetInactivityTimer(); // 重置无操作计时器
    }

    window.closeInfoModal = () => {
        infoModal.style.display = 'none';
    }

    startQuizButton.addEventListener('click', () => {
        infoModal.style.display = 'none';
        startQuiz();
    });

    function startQuiz() {
        // 获取当前关卡的问题
        currentQuiz = gameLevels[currentLevel].quiz.slice();
        
        currentQuestionIndex = 0;
        quizFeedbackElement.textContent = '';
        nextQuestionButton.style.display = 'none';
        loadQuestion();
        quizModal.style.display = 'flex';
    }

    function loadQuestion() {
        if (currentQuestionIndex >= currentQuiz.length) {
            // Quiz finished for this level
            quizModal.style.display = 'none';
            // 不再直接增加关卡，而是显示关卡过渡弹窗
            showLevelTransition();
            return;
        }

        const questionData = currentQuiz[currentQuestionIndex];
        
        // 设置问题标题，如果是洗牌道具题目，显示特殊标题
        if (questionData.isShuffleQuestion) {
            quizQuestionTitleElement.textContent = `🔄 洗牌道具题 - 答对即可获得洗牌道具`;
        } else {
            quizQuestionTitleElement.textContent = `健康知识问答 - 第 ${currentQuestionIndex + 1} 题`;
        }
        
        quizQuestionElement.textContent = questionData.question;
        quizOptionsElement.innerHTML = '';
        questionData.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.addEventListener('click', () => handleAnswer(option, questionData.answer, questionData.isShuffleQuestion));
            quizOptionsElement.appendChild(button);
        });
        quizFeedbackElement.textContent = '';
        nextQuestionButton.style.display = 'none';
        // Disable option buttons after an answer is chosen
        quizOptionsElement.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }

    function handleAnswer(selectedOption, correctAnswer, isShuffleQuestion) {
        const buttons = quizOptionsElement.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = true; // Disable all options
            if (button.textContent === correctAnswer) {
                button.classList.add('correct');
            }
            if (button.textContent === selectedOption && selectedOption !== correctAnswer) {
                button.classList.add('incorrect');
            }
        });

        if (selectedOption === correctAnswer) {
            // 如果是洗牌道具题目且回答正确，激活洗牌道具
            if (isShuffleQuestion) {
                shuffleAvailable = true;
                updateShuffleButton();
                quizFeedbackElement.textContent = '回答正确！获得了洗牌道具！';
            } else {
                quizFeedbackElement.textContent = '回答正确！';
            }
            
            quizFeedbackElement.style.color = 'green';
            nextQuestionButton.textContent = (currentQuestionIndex === currentQuiz.length - 1) ? '太棒了！进入下一关' : '下一题';
            nextQuestionButton.style.display = 'block';
        } else {
            quizFeedbackElement.textContent = `回答错误。正确答案是：${correctAnswer}`;
            quizFeedbackElement.style.color = 'red';
            // For simplicity, allow proceeding even if wrong. Could implement retry or penalty.
            nextQuestionButton.textContent = '知道了，继续学习';
            nextQuestionButton.style.display = 'block';
            // If strict, could force restart level or quiz: 
            // setTimeout(() => { quizModal.style.display = 'none'; loadLevel(); /* or restartQuiz() */ }, 2000);
        }
        
        // 重置无操作计时器
        resetInactivityTimer();
    }

    nextQuestionButton.addEventListener('click', () => {
        // Clear button styles
        quizOptionsElement.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('correct', 'incorrect');
            btn.disabled = false;
        });
        
        // Only advance if the answer was correct or if we allow proceeding on wrong answers
        // The current logic allows proceeding regardless, so we just increment the index.
        // If strict progression is needed, check quizFeedbackElement.style.color or a flag.
        if (quizFeedbackElement.style.color === 'green') { // Only advance if correct
             currentQuestionIndex++;
        }
        // If we want to force correct answer before proceeding, the logic in handleAnswer needs adjustment
        // For now, if they click next, and it was wrong, they just saw the answer.
        // If they were correct, they move to next question or level.
        loadQuestion(); 
    });

    window.closeQuizModal = () => {
        quizModal.style.display = 'none';
        // Potentially penalize or restart level if quiz is closed prematurely
    }

    function showGameComplete() {
        // 创建花朵奖励动画
        const flowerContainer = document.createElement('div');
        flowerContainer.className = 'flower-container';
        for (let i = 0; i < 20; i++) { // 创建20朵花
            const flower = document.createElement('div');
            flower.className = 'flower';
            flower.innerHTML = '🌸'; // 使用花朵emoji
            flower.style.left = `${Math.random() * 100}%`;
            flower.style.animationDuration = `${3 + Math.random() * 4}s`; // 随机动画持续时间
            flower.style.animationDelay = `${Math.random() * 2}s`; // 随机延迟
            flowerContainer.appendChild(flower);
        }
        
        // 添加到游戏完成弹窗
        const modalContent = gameCompleteModal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <h2>恭喜通关！</h2>
            <div class="reward-message">
                <p>🌸 您已成功完成所有关卡，掌握了许多关于胰腺炎的知识！🌸</p>
                <p>记住这些健康知识，保持良好的生活习惯，关爱自己的健康！</p>
                <p>祝您健康快乐每一天！</p>
            </div>
            <button onclick="restartGame()">重新开始游戏</button>
        `;
        
        modalContent.appendChild(flowerContainer);
        gameCompleteModal.style.display = 'flex';
        resetLevelButton.style.display = 'none';
        
        // 播放成功音效
        playMatchSound();
    }

    window.restartGame = () => {
        gameCompleteModal.style.display = 'none';
        startGame();
    }

    resetLevelButton.addEventListener('click', () => {
        score = gameLevels[currentLevel > 0 ? currentLevel -1 : 0].targetScore; // A bit of a hack to reset score to previous level's target if not first level
        if (currentLevel === 0) score = 0;
        // Or simply reset score to 0 for the current level attempt
        // score = 0; 
        currentScoreElement.textContent = score;
        loadLevel(); // Reloads current level
    });

    // Initial game start
    startGame();
});