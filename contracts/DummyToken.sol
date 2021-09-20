import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract DummyToken is ERC20 {
    constructor() ERC20('DUMMY', 'DMY') {
        _mint(msg.sender, 1e36);
    }
}
