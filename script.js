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

    let currentLevel = 0;
    let score = 0;
    let board = [];
    let selectedCell = null;
    let rows, cols, targetScore, itemTypes;
    let currentQuiz = [];
    let currentQuestionIndex = 0;
    let isCheckingMatch = false; // Flag to prevent concurrent match checks

    function startGame() {
        currentLevel = 0;
        score = 0;
        loadLevel();
        gameCompleteModal.style.display = 'none';
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

        initializeBoard();
        renderBoard();
        checkAllMatches(); // Check for initial matches and resolve them
    }

    function initializeBoard() {
        gameBoardElement.style.gridTemplateColumns = `repeat(${cols}, 50px)`;
        gameBoardElement.style.gridTemplateRows = `repeat(${rows}, 50px)`;
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
                cell.classList.add('game-cell', `type-${board[r][c]}`);
                cell.dataset.r = r;
                cell.dataset.c = c;
                if (board[r][c] === -1) { // -1 indicates an empty cell (to be filled)
                    cell.classList.add('hidden');
                }
                cell.addEventListener('click', handleCellClick);
                gameBoardElement.appendChild(cell);
            }
        }
    }

    function handleCellClick(event) {
        if (isCheckingMatch) return; // Don't allow clicks during match processing
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
            showInfo();
        }
    }

    function showInfo() {
        infoTextElement.textContent = gameLevels[currentLevel].info;
        infoModal.style.display = 'flex';
    }

    window.closeInfoModal = () => {
        infoModal.style.display = 'none';
    }

    startQuizButton.addEventListener('click', () => {
        infoModal.style.display = 'none';
        startQuiz();
    });

    function startQuiz() {
        currentQuiz = gameLevels[currentLevel].quiz;
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
            currentLevel++;
            // Score can be reset for next level or accumulated.
            // For this example, we'll keep accumulating for simplicity, but reset for a new game.
            // score = 0; // Uncomment to reset score per level
            loadLevel();
            return;
        }

        const questionData = currentQuiz[currentQuestionIndex];
        quizQuestionTitleElement.textContent = `健康知识问答 - 第 ${currentQuestionIndex + 1} 题`;
        quizQuestionElement.textContent = questionData.question;
        quizOptionsElement.innerHTML = '';
        questionData.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.addEventListener('click', () => handleAnswer(option, questionData.answer));
            quizOptionsElement.appendChild(button);
        });
        quizFeedbackElement.textContent = '';
        nextQuestionButton.style.display = 'none';
        // Disable option buttons after an answer is chosen
        quizOptionsElement.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }

    function handleAnswer(selectedOption, correctAnswer) {
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
            quizFeedbackElement.textContent = '回答正确！';
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
        gameCompleteModal.style.display = 'flex';
        resetLevelButton.style.display = 'none';
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