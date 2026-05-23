pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "../contracts/WethToDaiSwap.sol";


interface IERC20Minimal {
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IWETH is IERC20Minimal {
    function deposit() external payable;
}

contract WethToDaiSwapTest is Test {
    WethToDaiSwap swap;

    address user = address(0x123);

    ISwapRouter router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    address constant WETH =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address constant DAI =
        0x6B175474E89094C44Da98b954EedeAC495271d0F;

    function setUp() public {
        swap = new WethToDaiSwap(router);

        vm.deal(user, 10 ether);
    }

    function testDeploys() public view {
        assertTrue(address(swap) != address(0));
    }

    function testUserCanWrapEthIntoWeth() public {
        vm.startPrank(user);

        uint256 wethBefore = IERC20Minimal(WETH).balanceOf(user);

        IWETH(WETH).deposit{value: 1 ether}();

        uint256 wethAfter = IERC20Minimal(WETH).balanceOf(user);

        assertEq(wethAfter - wethBefore, 1 ether);

        vm.stopPrank();
    }
    function testUserCanApproveSwapContract() public {
        vm.startPrank(user);

        IWETH(WETH).deposit{value: 1 ether}();

        IERC20Minimal(WETH).approve(address(swap), 1 ether);

        uint256 allowance = IERC20Minimal(WETH).allowance(user, address(swap));

        assertEq(allowance, 1 ether);

        vm.stopPrank();
    }
    function testUserCanSwapWETHForDAI() public {
        uint256 amountIn = 0.1 ether;

        vm.startPrank(user);

        IWETH(WETH).deposit{value: 1 ether}();

        IERC20Minimal(WETH).approve(address(swap), amountIn);

        uint256 daiBefore = IERC20Minimal(DAI).balanceOf(user);
        uint256 wethBefore = IERC20Minimal(WETH).balanceOf(user);

        uint256 amountOut = swap.swapWETHForDAI(amountIn);

        uint256 daiAfter = IERC20Minimal(DAI).balanceOf(user);
        uint256 wethAfter = IERC20Minimal(WETH).balanceOf(user);

        assertGt(amountOut, 0);
        assertGt(daiAfter, daiBefore);
        assertEq(wethBefore - wethAfter, amountIn);

        vm.stopPrank();
    }
    function testSwapOutputsDai() public {
        uint256 amountIn = 0.1 ether;

        vm.startPrank(user);

        IWETH(WETH).deposit{value: 1 ether}();
        IERC20Minimal(WETH).approve(address(swap), amountIn);

        uint256 daiBefore = IERC20Minimal(DAI).balanceOf(user);

        uint256 amountOut = swap.swapWETHForDAI(amountIn);

        uint256 daiAfter = IERC20Minimal(DAI).balanceOf(user);

        assertGt(amountOut, 0);
        assertGt(daiAfter, daiBefore);

        vm.stopPrank();
    }
    function testSwapConsumesExactWethAmount() public {
        uint256 amountIn = 0.1 ether;

        vm.startPrank(user);

        IWETH(WETH).deposit{value: 1 ether}();
        IERC20Minimal(WETH).approve(address(swap), amountIn);

        uint256 wethBefore = IERC20Minimal(WETH).balanceOf(user);

        swap.swapWETHForDAI(amountIn);

        uint256 wethAfter = IERC20Minimal(WETH).balanceOf(user);

        assertEq(wethBefore - wethAfter, amountIn);

        vm.stopPrank();
    }
    function testSwapRevertsWithoutApproval() public {
        uint256 amountIn = 0.1 ether;

        vm.startPrank(user);

        IWETH(WETH).deposit{value: 1 ether}();

        vm.expectRevert();
        swap.swapWETHForDAI(amountIn);

        vm.stopPrank();
    }
}