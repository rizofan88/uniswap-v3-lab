// SPDX-License-Identifier: UNLICENSED
pragma solidity^0.8.20 ;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract SwapRouterSingle {
    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _swapRouter){
        swapRouter = _swapRouter;
    }

    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24  fee,
        address recipient,
        uint256 deadline,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut) {
        // msg.sender must approve this contract
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        
        // this contract must approve the swapRouter
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = 
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        amountOut = swapRouter.exactInputSingle(params);
    }

}

