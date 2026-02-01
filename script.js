// 全局变量
let fundList = [];
// 估值接口（公开合规，和主流平台同步）
const FUND_API = 'https://fundmobapi.eastmoney.com/FundMobiApi/JS/FundBasicInfoApi.ashx?fundcode=';
const VALUATION_API = 'https://fundmobapi.eastmoney.com/FundMobiApi/JS/FundEstimateApi.ashx?fundcode=';

// 页面加载完成后执行
window.onload = function() {
    // 读取本地持仓
    const localFund = localStorage.getItem('fundHoldList');
    if (localFund) {
        fundList = JSON.parse(localFund);
        if (fundList.length > 0) {
            loadAllFundData();
        }
    }
    // 绑定事件
    bindEvents();
    // 下拉刷新
    pullToRefresh();
};

// 绑定所有按钮事件
function bindEvents() {
    // 编辑持仓
    document.getElementById('editBtn').addEventListener('click', () => {
        showModal();
        // 回填持仓数据
        let text = '基金代码,持仓份额,持仓成本\n';
        fundList.forEach(item => {
            text += `${item.code},${item.share},${item.cost}\n`;
        });
        document.getElementById('fundText').value = text.trim();
    });
    // 关闭弹窗
    document.getElementById('closeBtn').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    document.getElementById('modalMask').addEventListener('click', hideModal);
    // 保存持仓
    document.getElementById('saveBtn').addEventListener('click', saveFundList);
}

// 解析并保存持仓
function saveFundList() {
    const text = document.getElementById('fundText').value.trim();
    if (!text) {
        alert('请填写持仓信息！');
        return;
    }
    const lines = text.split('\n');
    const newFundList = [];
    // 跳过标题行，遍历每一行
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [code, share, cost] = line.split(',');
        // 格式校验
        if (!/^\d{6}$/.test(code) || isNaN(Number(share)) || isNaN(Number(cost)) || Number(share) <= 0 || Number(cost) <= 0) {
            alert(`第${i+1}行格式错误，请检查！`);
            return;
        }
        newFundList.push({
            code: code,
            share: Number(share),
            cost: Number(cost),
            name: '',
            now: 0,
            rate: 0,
            profit: 0,
            value: 0
        });
    }
    if (newFundList.length === 0) {
        alert('请填写有效持仓信息！');
        return;
    }
    // 保存到本地
    fundList = newFundList;
    localStorage.setItem('fundHoldList', JSON.stringify(fundList));
    hideModal();
    // 加载基金数据
    loadAllFundData();
    alert('持仓保存成功，正在加载实时估值...');
}

// 加载所有基金数据
function loadAllFundData() {
    const fundListDom = document.getElementById('fundList');
    fundListDom.innerHTML = '<div class="fund-item placeholder">正在加载实时估值，请稍候...</div>';
    // 清空总览
    document.getElementById('totalValue').innerText = '0.00';
    document.getElementById('totalProfit').innerText = '+0.00';
    document.getElementById('totalRate').innerText = '+0.00%';
    document.getElementById('totalProfit').className = 'profit';
    document.getElementById('totalRate').className = 'profit';

    let totalValue = 0;
    let totalCost = 0;
    fundListDom.innerHTML = '';

    // 遍历加载每只基金
    fundList.forEach(async (fund, index) => {
        try {
            // 获取基金基本信息（名称）
            const basicRes = await fetch(FUND_API + fund.code);
            const basicText = await basicRes.text();
            const basicData = JSON.parse(basicText.replace(/^jsonp\(|\)$/g, ''));
            fund.name = basicData.Name || fund.code;

            // 获取实时估值
            const valRes = await fetch(VALUATION_API + fund.code);
            const valText = await valRes.text();
            const valData = valText.replace(/^jsonp\(|\)$/g, '').split(',');
            if (valData.length < 3) throw new Error('估值数据异常');

            // 解析估值和涨跌幅
            fund.now = Number(valData[1]); // 实时估值
            fund.rate = Number(valData[2].replace(/%/g, '')); // 涨跌幅(%)

            // 计算持仓数据
            fund.value = (fund.now * fund.share).toFixed(2); // 当前市值
            fund.profit = (fund.now - fund.cost) * fund.share; // 浮动盈亏
            fund.profitRate = ((fund.now - fund.cost) / fund.cost * 100).toFixed(2); // 收益率

            // 累加总数据
            totalValue += Number(fund.value);
            totalCost += fund.cost * fund.share;

            // 渲染单只基金
            renderFundItem(fund);

            // 最后一只基金加载完成后渲染总览
            if (index === fundList.length - 1) {
                renderTotal(totalValue, totalCost);
            }
        } catch (err) {
            fundListDom.innerHTML += `<div class="fund-item">基金${fund.code}加载失败，请检查代码是否正确！</div>`;
        }
    });
}

// 渲染单只基金
function renderFundItem(fund) {
    const fundListDom = document.getElementById('fundList');
    const rateClass = fund.rate >= 0 ? 'change-rate plus' : 'change-rate';
    const profitClass = fund.profit >= 0 ? 'hold-profit plus' : 'hold-profit';
    const profitText = fund.profit >= 0 ? `+${fund.profit.toFixed(2)}` : fund.profit.toFixed(2);
    const rateText = fund.rate >= 0 ? `+${fund.rate.toFixed(2)}%` : `${fund.rate.toFixed(2)}%`;

    const fundItem = document.createElement('div');
    fundItem.className = 'fund-item';
    fundItem.innerHTML = `
        <div class="fund-info">
            <span class="fund-code">${fund.code}</span>
            <span class="fund-name">${fund.name}</span>
            <span class="fund-now">${fund.now.toFixed(4)}</span>
        </div>
        <div class="fund-change">
            <span class="${rateClass}">${rateText}</span>
            <span class="hold-cost">成本：${fund.cost.toFixed(4)}</span>
        </div>
        <div class="fund-hold">
            <span>市值：${fund.value}元 | 份额：${fund.share}份</span>
            <span class="${profitClass}">收益：${profitText}元 (${fund.profitRate}%)</span>
        </div>
    `;
    fundListDom.appendChild(fundItem);
}

// 渲染持仓总览
function renderTotal(totalValue, totalCost) {
    const totalProfit = (totalValue - totalCost).toFixed(2);
    const totalRate = totalCost === 0 ? 0 : ((totalValue - totalCost) / totalCost * 100).toFixed(2);
    const profitClass = totalProfit >= 0 ? 'profit plus' : 'profit';
    const rateClass = totalRate >= 0 ? 'profit plus' : 'profit';
    const profitText = totalProfit >= 0 ? `+${totalProfit}` : totalProfit;
    const rateText = totalRate >= 0 ? `+${totalRate}%` : `${totalRate}%`;

    document.getElementById('totalValue').innerText = totalValue.toFixed(2);
    document.getElementById('totalProfit').innerText = profitText;
    document.getElementById('totalProfit').className = profitClass;
    document.getElementById('totalRate').innerText = rateText;
    document.getElementById('totalRate').className = rateClass;
}

// 显示弹窗
function showModal() {
    document.getElementById('modalMask').style.display = 'block';
    document.getElementById('modal').style.display = 'block';
}

// 隐藏弹窗
function hideModal() {
    document.getElementById('modalMask').style.display = 'none';
    document.getElementById('modal').style.display = 'none';
}

// 下拉刷新功能
function pullToRefresh() {
    let startY = 0;
    const refreshTip = document.getElementById('refreshTip');
    // 触摸开始
    document.body.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    });
    // 触摸移动
    document.body.addEventListener('touchmove', (e) => {
        const moveY = e.touches[0].clientY;
        if (moveY - startY > 50 && document.documentElement.scrollTop === 0) {
            refreshTip.style.display = 'block';
        }
    });
    // 触摸结束
    document.body.addEventListener('touchend', () => {
        refreshTip.style.display = 'none';
        if (fundList.length > 0) {
            loadAllFundData();
            alert('正在刷新实时估值...');
        }
    });
    // 电脑端刷新按钮
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5') {
            if (fundList.length > 0) loadAllFundData();
        }
    });
}
