// a dummy handler contract 
import {ISafe, IStaticFallbackMethod, IFallbackMethod, ExtensibleBase} from "../munged/handler/extensible/ExtensibleBase.sol";

contract DummyHandler is IFallbackMethod {
    constructor(){
        methodCalled = false ;
    }

    bool public methodCalled ;
    function resetMethodCalled() public {
        methodCalled = false; 
    }

    // the DUMMY method
    function handle(ISafe safe, address sender, uint256 value, bytes calldata data) external override returns (bytes memory result) {
        methodCalled = true ;
        
        return "Hello, world!";
    }

    function dummyMethod() public {
        methodCalled = true ;
    }
}