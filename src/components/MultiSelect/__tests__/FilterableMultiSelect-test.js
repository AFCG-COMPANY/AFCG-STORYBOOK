import React from 'react';
import { mount } from 'enzyme';
import MultiSelect from '../../MultiSelect';
import {
  assertMenuClosed,
  assertMenuOpen,
  findMenuIconNode,
  openMenu,
  generateItems,
  generateGenericItem,
} from '../../ListBox/test-helpers';

const listItemName = 'ListBoxMenuItem';

describe('MultiSelect.Filterable', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      disabled: false,
      items: generateItems(5, generateGenericItem),
      initialSelectedItems: [],
      onChange: jest.fn(),
      placeholder: 'Placeholder...',
    };
  });

  it('should render', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should display all items when the menu is open initially', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    openMenu(wrapper);
    expect(wrapper.find(listItemName).length).toBe(mockProps.items.length);
  });

  it('should let the user toggle the menu by the menu icon', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    findMenuIconNode(wrapper).simulate('click');
    assertMenuOpen(wrapper, mockProps);
    findMenuIconNode(wrapper).simulate('click');
    assertMenuClosed(wrapper);
  });

  it('should not close the menu after a user makes a selection', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    openMenu(wrapper);
    wrapper
      .find(listItemName)
      .at(0)
      .simulate('click');
    assertMenuOpen(wrapper, mockProps);
  });

  it('should filter a list of items by the input value', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    openMenu(wrapper);
    expect(wrapper.find(listItemName).length).toBe(mockProps.items.length);
    wrapper.setState({ inputValue: '3' });
    expect(wrapper.find(listItemName).length).toBe(1);
  });

  it('should call `onChange` with each update to selected items', () => {
    const wrapper = mount(<MultiSelect.Filterable {...mockProps} />);
    openMenu(wrapper);

    // Select the first two items
    wrapper
      .find(listItemName)
      .at(0)
      .simulate('click');

    expect(mockProps.onChange).toHaveBeenCalledTimes(1);
    expect(mockProps.onChange).toHaveBeenCalledWith({
      selectedItems: [mockProps.items[0]],
    });

    wrapper
      .find(listItemName)
      .at(1)
      .simulate('click');

    expect(mockProps.onChange).toHaveBeenCalledTimes(2);
    expect(mockProps.onChange).toHaveBeenCalledWith({
      selectedItems: [mockProps.items[0], mockProps.items[1]],
    });

    // Un-select the next two items
    wrapper
      .find(listItemName)
      .at(0)
      .simulate('click');
    expect(mockProps.onChange).toHaveBeenCalledTimes(3);
    expect(mockProps.onChange).toHaveBeenCalledWith({
      selectedItems: [mockProps.items[1]],
    });

    wrapper
      .find(listItemName)
      .at(0)
      .simulate('click');
    expect(mockProps.onChange).toHaveBeenCalledTimes(4);
    expect(mockProps.onChange).toHaveBeenCalledWith({
      selectedItems: [],
    });
  });
});
