import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash.isequal';
import getDerivedStateFromProps from './state/getDerivedStateFromProps';
import { getNextSortState } from './state/sorting';
import denormalize from './tools/denormalize';
import { composeEventHandlers } from './tools/events';
import { defaultFilterRows } from './tools/filter';
import { defaultSortRow } from './tools/sorting';
import setupGetInstanceId from './tools/instanceId';

const getInstanceId = setupGetInstanceId();

const translationKeys = {
  expandRow: 'carbon.table.row.expand',
  collapseRow: 'carbon.table.row.collapse',
  selectAll: 'carbon.table.all.select',
  unselectAll: 'carbon.table.all.unselect',
  selectRow: 'carbon.table.row.select',
  unselectRow: 'carbon.table.row.unselect',
};

const defaultTranslations = {
  [translationKeys.expandRow]: 'Expand current row',
  [translationKeys.collapseRow]: 'Collapse current row',
  [translationKeys.selectAll]: 'Select all rows',
  [translationKeys.unselectAll]: 'Unselect all rows',
  [translationKeys.selectRow]: 'Select row',
  [translationKeys.unselectRow]: 'Unselect row',
};

const translateWithId = id => defaultTranslations[id];

/**
 * Data Tables are used to represent a collection of resources, displaying a
 * subset of their fields in columns, or headers. We prioritize direct updates
 * to the state of what we're rendering, so internally we end up normalizing the
 * given data and then denormalizing it when rendering.
 *
 * As a result, each part of the DataTable is accessible through look-up by id,
 * and updating the state of the single entity will cascade updates to the
 * consumer.
 */
export default class DataTable extends React.Component {
  static propTypes = {
    /**
     * The `rows` prop is where you provide us with a list of all the rows that
     * you want to render in the table. The only hard requirement is that this
     * is an array of objects, and that each object has a unique `id` field
     * available on it.
     */
    rows: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
      })
    ).isRequired,

    /**
     * The `headers` prop represents the order in which the headers should
     * appear in the table. We expect an array of objects to be passed in, where
     * `key` is the name of the key in a row object, and `header` is the name of
     * the header.
     */
    headers: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        header: PropTypes.string.isRequired,
      })
    ).isRequired,

    /**
     * Optional hook to manually control sorting of the rows.
     */
    sortRow: PropTypes.func,

    /**
     * Optional hook to manually control filtering of the rows from the
     * TableToolbarSearch component
     */
    filterRows: PropTypes.func,

    /**
     * Provide a string for the current locale
     */
    locale: PropTypes.string,

    /**
     * Optional method that takes in a message id and returns an
     * internationalized string. See `DataTable.translationKeys` for all
     * available message ids.
     */
    translateWithId: PropTypes.func,
  };

  static defaultProps = {
    sortRow: defaultSortRow,
    filterRows: defaultFilterRows,
    locale: 'en',
    translateWithId,
  };

  static translationKeys = Object.values(translationKeys);

  constructor(props) {
    super(props);
    this.state = getDerivedStateFromProps(props, {});
    this.instanceId = getInstanceId();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const rowIds = this.props.rows.map(row => row.id);
    const nextRowIds = nextProps.rows.map(row => row.id);

    if (!isEqual(rowIds, nextRowIds)) {
      this.setState(state => getDerivedStateFromProps(nextProps, state));
      return;
    }

    const headers = this.props.headers.map(header => header.key);
    const nextHeaders = nextProps.headers.map(header => header.key);

    if (!isEqual(headers, nextHeaders)) {
      this.setState(state => getDerivedStateFromProps(nextProps, state));
      return;
    }

    if (!isEqual(this.props.rows, nextProps.rows)) {
      this.setState(state => getDerivedStateFromProps(nextProps, state));
      return;
    }
  }

  /**
   * Get the props associated with the given header. Mostly used for adding in
   * sorting behavior.
   *
   * @param {Object} config
   * @param {string} config.header the header we want the props for
   * @param {Function} config.onClick a custom click handler for the header
   * @returns {Object}
   */
  getHeaderProps = ({ header, onClick, ...rest }) => {
    const { sortDirection, sortHeaderKey } = this.state;
    return {
      ...rest,
      key: header.key,
      sortDirection,
      isSortable: true,
      isSortHeader: sortHeaderKey === header.key,
      // Compose the event handlers so we don't overwrite a consumer's `onClick`
      // handler
      onClick: composeEventHandlers([this.handleSortBy(header.key), onClick]),
    };
  };

  /**
   * Get the props associated with the given row. Mostly used for expansion.
   *
   * @param {Object} config
   * @param {Object} config.row the row we want the props for
   * @param {Function} config.onClick a custom click handler for the header
   * @returns {Object}
   */
  getRowProps = ({ row, onClick, ...rest }) => {
    const { translateWithId: t } = this.props;
    const translationKey = row.isExpanded
      ? translationKeys.collapseRow
      : translationKeys.expandRow;
    return {
      ...rest,
      key: row.id,
      // Compose the event handlers so we don't overwrite a consumer's `onClick`
      // handler
      onExpand: composeEventHandlers([this.handleOnExpandRow(row.id), onClick]),
      isExpanded: row.isExpanded,
      ariaLabel: t(translationKey),
    };
  };

  /**
   * Gets the props associated with selection for a header or a row, where
   * applicable. Most often used to indicate selection status of the table or
   * for a specific row.
   *
   * @param {Object} [row] an optional row that we want to access the props for
   * @returns {Object}
   */
  getSelectionProps = ({ onClick, row, ...rest } = {}) => {
    const { translateWithId: t } = this.props;

    // If we're given a row, return the selection state values for that row
    if (row) {
      const translationKey = row.isSelected
        ? translationKeys.unselectRow
        : translationKeys.selectRow;
      return {
        ...rest,
        checked: row.isSelected,
        onSelect: composeEventHandlers([
          this.handleOnSelectRow(row.id),
          onClick,
        ]),
        id: `${this.getTablePrefix()}__select-row-${row.id}`,
        name: `select-row-${row.id}`,
        ariaLabel: t(translationKey),
      };
    }

    // Otherwise, we're working on `TableSelectAll` which handles toggling the
    // selection state of all rows.
    const rowCount = this.state.rowIds.length;
    const selectedRowCount = this.getSelectedRows().length;
    const checked = rowCount > 0 && selectedRowCount === rowCount;
    const indeterminate =
      rowCount > 0 && selectedRowCount > 0 && selectedRowCount !== rowCount;

    const translationKey = checked
      ? translationKeys.unselectAll
      : translationKeys.selectAll;
    return {
      ...rest,
      ariaLabel: t(translationKey),
      checked,
      id: `${this.getTablePrefix()}__select-all`,
      indeterminate,
      name: 'select-all',
      onSelect: composeEventHandlers([this.handleSelectAll, onClick]),
    };
  };

  getBatchActionProps = (props = {}) => {
    const { shouldShowBatchActions } = this.state;
    const totalSelected = this.getSelectedRows().length;
    return {
      ...props,
      shouldShowBatchActions,
      totalSelected,
      onCancel: this.handleOnCancel,
    };
  };

  /**
   * Helper utility to get all the currently selected rows
   * @returns {Array<string>} the array of rowIds that are currently selected
   */
  getSelectedRows = () =>
    this.state.rowIds.filter(id => {
      const row = this.state.rowsById[id];
      return row.isSelected;
    });

  /**
   * Helper for getting the table prefix for elements that require an
   * `id` attribute that is unique.
   *
   * @returns {string}
   */
  getTablePrefix = () => `data-table-${this.instanceId}`;

  /**
   * Helper for toggling all selected items in a state. Does not call
   * setState, so use it when setting state.
   * @param {Object} initialState
   * @returns {Object} object to put into this.setState (use spread operator)
   */
  setAllSelectedState = (initialState, isSelected) => {
    const { rowIds } = initialState;
    return {
      rowsById: rowIds.reduce(
        (acc, id) => ({
          ...acc,
          [id]: {
            ...initialState.rowsById[id],
            isSelected,
          },
        }),
        {}
      ),
    };
  };

  /**
   * Handler for the `onCancel` event to hide the batch action bar and
   * deselect all selected rows
   */
  handleOnCancel = () => {
    this.setState(state => {
      return {
        shouldShowBatchActions: false,
        ...this.setAllSelectedState(state, false),
      };
    });
  };

  /**
   * Handler for toggling the selection state of all rows in the database
   */
  handleSelectAll = () => {
    this.setState(state => {
      const { rowIds } = state;
      const isSelected = this.getSelectedRows().length !== rowIds.length;
      return {
        shouldShowBatchActions: isSelected,
        ...this.setAllSelectedState(state, isSelected),
      };
    });
  };

  /**
   * Handler for toggling the selection state of a given row.
   *
   * @param {string} rowId
   * @returns {Function}
   */
  handleOnSelectRow = rowId => () => {
    this.setState(state => {
      const row = state.rowsById[rowId];
      const selectedRows = state.rowIds.filter(id => {
        return state.rowsById[id].isSelected;
      }).length;
      // Predict the length of the selected rows after this change occurs
      const selectedRowsCount = !row.isSelected
        ? selectedRows + 1
        : selectedRows - 1;
      return {
        // Basic assumption here is that we want to show the batch action bar if
        // the row is being selected. If it's being unselected, then see if we
        // have a non-zero number of selected rows that batch actions could
        // still apply to
        shouldShowBatchActions: !row.isSelected || selectedRowsCount > 0,
        rowsById: {
          ...state.rowsById,
          [rowId]: {
            ...row,
            isSelected: !row.isSelected,
          },
        },
      };
    });
  };

  /**
   * Handler for toggling the expansion state of a given row.
   *
   * @param {string} rowId
   * @returns {Function}
   */
  handleOnExpandRow = rowId => () => {
    this.setState(state => {
      const row = state.rowsById[rowId];
      return {
        rowsById: {
          ...state.rowsById,
          [rowId]: {
            ...row,
            isExpanded: !row.isExpanded,
          },
        },
      };
    });
  };

  /**
   * Handler for transitioning to the next sort state of the table
   *
   * @param {string} headerKey the field for the header that we are sorting by
   * @returns {Function}
   */
  handleSortBy = headerKey => () => {
    this.setState(state =>
      getNextSortState(this.props, state, { key: headerKey })
    );
  };

  /**
   * Event handler for transitioning input value state changes for the table
   * filter component.
   *
   * @param {Event} event
   */
  handleOnInputValueChange = event => {
    this.setState({ filterInputValue: event.target.value });
  };

  render() {
    const { children, filterRows, headers, render } = this.props;
    const { filterInputValue, rowIds, rowsById, cellsById } = this.state;
    const filteredRowIds =
      typeof filterInputValue === 'string'
        ? filterRows({
            rowIds,
            headers,
            cellsById,
            inputValue: filterInputValue,
          })
        : rowIds;
    const renderProps = {
      // Data derived from state
      rows: denormalize(filteredRowIds, rowsById, cellsById),
      headers: this.props.headers,
      selectedRows: denormalize(this.getSelectedRows(), rowsById, cellsById),

      // Prop accessors/getters
      getHeaderProps: this.getHeaderProps,
      getRowProps: this.getRowProps,
      getSelectionProps: this.getSelectionProps,
      getBatchActionProps: this.getBatchActionProps,

      // Custom event handlers
      onInputChange: this.handleOnInputValueChange,

      // Expose internal state change actions
      sortBy: headerKey => this.handleSortBy(headerKey)(),
      selectAll: this.handleSelectAll,
      selectRow: rowId => this.handleOnSelectRow(rowId)(),
      expandRow: rowId => this.handleOnExpandRow(rowId)(),
    };

    if (render !== undefined) {
      return render(renderProps);
    }

    if (children !== undefined) {
      return children(renderProps);
    }

    return null;
  }
}
